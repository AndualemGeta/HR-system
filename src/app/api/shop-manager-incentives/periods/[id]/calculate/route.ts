import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { calculateAllShopManagerIncentives } from '@/lib/shop-manager-incentives'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.calculate'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status !== 'OPEN' && period.status !== 'OPEN_FOR_INPUT') {
      return badRequest('Period must be in OPEN or OPEN_FOR_INPUT status to calculate')
    }

    const result = await calculateAllShopManagerIncentives(id)

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_CALCULATE',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: 'CALCULATED' },
    })

    return success(result)
  } catch (err) { console.error(err); return internalError() }
}
