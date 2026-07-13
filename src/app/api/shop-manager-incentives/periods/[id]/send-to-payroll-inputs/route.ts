import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { sendIncentivesToPayrollInputs } from '@/lib/shop-manager-incentives'

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

    if (period.status !== 'CALCULATED') {
      return badRequest(`Period status must be CALCULATED (current: ${period.status})`)
    }

    const result = await sendIncentivesToPayrollInputs(id)

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_SEND_TO_PAYROLL',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      newValue: { periodId: id, payrollPeriodId: period.payrollPeriodId, calculationsProcessed: result.calculationsProcessed },
    })

    return success(result)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
