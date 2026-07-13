import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { getPayrollHandoffPreview } from '@/lib/shop-manager-incentives'
import { buildIncentiveScopeWhere } from '@/lib/incentive-scope'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.sendToPayroll'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const scopeWhere = await buildIncentiveScopeWhere(session.userId)
    const result = await getPayrollHandoffPreview(id, scopeWhere)
    return success(result)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
