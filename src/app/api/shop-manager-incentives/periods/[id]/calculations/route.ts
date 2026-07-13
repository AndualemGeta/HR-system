import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { buildIncentiveScopeWhere } from '@/lib/incentive-scope'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!period) return notFound('Incentive period not found')

    const scopeWhere = await buildIncentiveScopeWhere(session.userId)
    const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
      where: { incentivePeriodId: id, ...scopeWhere },
      include: {
        shopLocation: { select: { id: true, name: true, code: true } },
        shopManager: { select: { id: true, fullName: true, employeeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const data = calculations.map((c) => ({
      id: c.id,
      shopLocation: c.shopLocation,
      shopManager: c.shopManager,
      shopCriteria: c.shopCriteria,
      qgaBonus: c.qgaBonus ? Number(c.qgaBonus) : null,
      qgaSimCommission: c.qgaSimCommission ? Number(c.qgaSimCommission) : null,
      evdBonus: c.evdBonus ? Number(c.evdBonus) : null,
      mpesaCommission: c.mpesaCommission ? Number(c.mpesaCommission) : null,
      baSiteBonus: c.baSiteBonus ? Number(c.baSiteBonus) : null,
      dsaAchievementBonus: c.dsaAchievementBonus ? Number(c.dsaAchievementBonus) : null,
      qoBonus: c.qoBonus ? Number(c.qoBonus) : null,
      ebuActivationBonus: c.ebuActivationBonus ? Number(c.ebuActivationBonus) : null,
      ebuRevenueShare: c.ebuRevenueShare ? Number(c.ebuRevenueShare) : null,
      totalIncentive: c.totalIncentive ? Number(c.totalIncentive) : null,
      calculationNote: c.calculationNote,
      calculatedAt: c.calculatedAt,
    }))

    return success(data)
  } catch (err) { console.error(err); return internalError() }
}
