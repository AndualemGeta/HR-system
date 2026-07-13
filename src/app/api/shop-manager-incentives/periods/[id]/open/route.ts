import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.updatePeriod'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status !== 'DRAFT') return badRequest('Only DRAFT periods can be opened')

    const inputCount = await prisma.shopManagerIncentiveInput.count({
      where: { incentivePeriodId: id },
    })
    if (inputCount === 0) return badRequest('No valid inputs exist for this period')

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id },
      data: { status: 'OPEN' },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_PERIOD_OPEN',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: updated.status },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
