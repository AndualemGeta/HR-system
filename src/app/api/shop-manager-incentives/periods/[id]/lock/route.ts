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
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.lock'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status !== 'APPROVED') return badRequest('Only APPROVED periods can be locked')

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockedById: session.userId,
        lockedAt: new Date(),
      },
    })

    await prisma.shopManagerIncentiveCalculation.updateMany({
      where: { incentivePeriodId: id },
      data: { status: 'LOCKED', lockedById: session.userId, lockedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_LOCK',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: updated.status, lockedById: session.userId },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
