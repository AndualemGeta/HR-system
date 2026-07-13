import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

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

    const [totalShops, goldCount, silverCount, bronzeCount, atRiskCount, calculationAgg] = await Promise.all([
      prisma.shopManagerIncentiveInput.count({ where: { incentivePeriodId: id } }),
      prisma.shopManagerIncentiveInput.count({
        where: { incentivePeriodId: id, shopCriteria: 'GOLD' },
      }),
      prisma.shopManagerIncentiveInput.count({
        where: { incentivePeriodId: id, shopCriteria: 'SILVER' },
      }),
      prisma.shopManagerIncentiveInput.count({
        where: { incentivePeriodId: id, shopCriteria: 'BRONZE' },
      }),
      prisma.shopManagerIncentiveInput.count({
        where: { incentivePeriodId: id, shopCriteria: 'AT_RISK' },
      }),
      prisma.shopManagerIncentiveCalculation.aggregate({
        where: { incentivePeriodId: id },
        _sum: {
          totalIncentive: true,
          qgaBonus: true,
          qgaSimCommission: true,
          evdBonus: true,
          mpesaCommission: true,
          baSiteBonus: true,
          dsaAchievementBonus: true,
          qoBonus: true,
          ebuActivationBonus: true,
          ebuRevenueShare: true,
        },
        _avg: {
          totalIncentive: true,
        },
        _max: {
          totalIncentive: true,
        },
        _count: true,
      }),
    ])

    const sums = calculationAgg._sum
    const avg = calculationAgg._avg
    const max = calculationAgg._max

    return success({
      totalShops,
      goldCount,
      silverCount,
      bronzeCount,
      atRiskCount,
      totalIncentive: Number(sums.totalIncentive) || 0,
      averageIncentive: Number(avg.totalIncentive) || 0,
      highestIncentive: Number(max.totalIncentive) || 0,
      componentTotals: {
        qgaBonus: Number(sums.qgaBonus) || 0,
        qgaSimCommission: Number(sums.qgaSimCommission) || 0,
        evdBonus: Number(sums.evdBonus) || 0,
        mpesaCommission: Number(sums.mpesaCommission) || 0,
        baSiteBonus: Number(sums.baSiteBonus) || 0,
        dsaAchievementBonus: Number(sums.dsaAchievementBonus) || 0,
        qoBonus: Number(sums.qoBonus) || 0,
        ebuActivationBonus: Number(sums.ebuActivationBonus) || 0,
        ebuRevenueShare: Number(sums.ebuRevenueShare) || 0,
      },
    })
  } catch (err) { console.error(err); return internalError() }
}
