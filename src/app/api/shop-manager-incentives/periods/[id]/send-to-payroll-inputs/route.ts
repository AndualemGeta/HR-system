import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { sendIncentivesToPayrollInputs } from '@/lib/shop-manager-incentives'
import { buildIncentiveScopeWhere } from '@/lib/incentive-scope'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.sendToPayroll'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({
      where: { id },
      include: { payrollPeriod: { select: { id: true, periodName: true, status: true } } },
    })
    if (!period) return notFound('Incentive period not found')

    if (period.status !== 'CALCULATED') {
      return badRequest(`Period status must be CALCULATED (current: ${period.status})`)
    }

    if (period.payrollPeriod && (period.payrollPeriod.status === 'INPUT_COLLECTION_CLOSED' || period.payrollPeriod.status === 'CANCELLED')) {
      return badRequest(`Linked payroll period is ${period.payrollPeriod.status} — cannot handoff`)
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { roles: { include: { role: true } } },
    })
    const roleNames = user?.roles.map(r => r.role.name) || []
    const canHandoff = roleNames.some(r => ['SUPER_ADMIN', 'HR_ADMIN', 'SALES_HEAD', 'FINANCE_DIRECTOR', 'FINANCE_PAYROLL'].includes(r))
    if (!canHandoff) return forbidden()

    const body = await req.json().catch(() => ({}))
    const mode = body.mode === 'SKIP_EXISTING' ? 'SKIP_EXISTING' : 'UPDATE_EXISTING_UNLOCKED'

    const scopeWhere = await buildIncentiveScopeWhere(session.userId)
    const result = await sendIncentivesToPayrollInputs(id, mode, scopeWhere)

    const blockedCount = (result.blockedLocked || 0) + (result.missingManager || 0)

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_SEND_TO_PAYROLL',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      newValue: {
        periodId: id,
        payrollPeriodId: period.payrollPeriodId,
        mode,
        created: result.created,
        updated: result.updated,
        skippedZero: result.skippedZero,
        blockedLocked: result.blockedLocked,
        missingManager: result.missingManager,
      },
    })

    if (blockedCount > 0) {
      await createAuditLog({
        userId: session.userId,
        action: 'SHOP_MANAGER_INCENTIVE_PAYROLL_HANDOFF_BLOCKED',
        entityType: 'ShopManagerIncentivePeriod',
        entityId: id,
        newValue: { blockedLocked: result.blockedLocked, missingManager: result.missingManager },
      })
    }

    return success(result)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
