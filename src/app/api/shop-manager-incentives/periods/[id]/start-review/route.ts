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
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.review'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status !== 'CALCULATED') return badRequest('Only CALCULATED periods can start review')

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id },
      data: {
        status: 'UNDER_REVIEW',
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_REVIEW_START',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: updated.status, reviewedById: session.userId },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
