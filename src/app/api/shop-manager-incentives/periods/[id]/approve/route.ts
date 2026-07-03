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
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.approve'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({
      where: { id },
      include: {
        issues: {
          where: { severity: 'BLOCKER', isResolved: false },
          take: 1,
        },
      },
    })
    if (!period) return notFound('Incentive period not found')
    if (period.status !== 'UNDER_REVIEW') return badRequest('Only UNDER_REVIEW periods can be approved')

    if (period.issues.length > 0) {
      return badRequest('Cannot approve period with unresolved BLOCKER issues')
    }

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: session.userId,
        approvedAt: new Date(),
      },
    })

    await prisma.shopManagerIncentiveCalculation.updateMany({
      where: { incentivePeriodId: id },
      data: { status: 'APPROVED', approvedById: session.userId, approvedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_APPROVE',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: updated.status, approvedById: session.userId },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
