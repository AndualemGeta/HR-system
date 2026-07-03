import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { sendApprovedIncentivesToPayrollInputs } from '@/lib/shop-manager-incentives'

const VALID_OVERWRITE_MODES = ['SKIP_EXISTING', 'UPDATE_EXISTING_DRAFT_ONLY', 'REPLACE_EXISTING_NOT_LOCKED'] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.sendToPayroll'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({
      where: { id },
      include: { payrollPeriod: { select: { id: true, periodName: true } } },
    })
    if (!period) return notFound('Incentive period not found')

    if (period.status !== 'APPROVED' && period.status !== 'LOCKED') {
      return badRequest(`Period status must be APPROVED or LOCKED (current: ${period.status})`)
    }

    const { searchParams } = new URL(req.url)
    const overwriteMode = searchParams.get('overwriteMode') || 'SKIP_EXISTING'
    if (!VALID_OVERWRITE_MODES.includes(overwriteMode as any)) {
      return badRequest(`Invalid overwriteMode. Must be one of: ${VALID_OVERWRITE_MODES.join(', ')}`)
    }

    const result = await sendApprovedIncentivesToPayrollInputs(id, { overwriteMode })

    const details = result.details || []
    const created = details.filter((d: any) => d.action === 'CREATED').length
    const skipped = details.filter((d: any) => d.action.startsWith('SKIPPED')).length
    const updated = details.filter((d: any) => d.action === 'UPDATED').length

    const summary = {
      periodId: id,
      payrollPeriodId: period.payrollPeriodId,
      totalCalculations: result.calculationsProcessed || 0,
      payrollInputsCreated: created,
      payrollInputsSkipped: skipped,
      payrollInputsUpdated: updated,
      overwriteMode,
    }

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_SEND_TO_PAYROLL',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      newValue: summary,
    })

    return success(summary)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
