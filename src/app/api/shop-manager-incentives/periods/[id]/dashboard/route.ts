import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { computeReadiness } from '@/lib/shop-manager-incentives'
import { buildIncentiveScopeWhere } from '@/lib/incentive-scope'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!period) return notFound('Incentive period not found')

    const scopeWhere = await buildIncentiveScopeWhere(session.userId)
    const [inputs, calculationAgg, staleCount] = await Promise.all([
      prisma.shopManagerIncentiveInput.findMany({
        where: { incentivePeriodId: id, ...scopeWhere },
        include: {
          calculation: { select: { calculatedAt: true } },
          shopManager: { select: { id: true } },
        },
      }),
      prisma.shopManagerIncentiveCalculation.aggregate({
        where: { incentivePeriodId: id, ...scopeWhere },
        _sum: {
          totalIncentive: true,
          qgaBonus: true, qgaSimCommission: true, evdBonus: true,
          mpesaCommission: true, baSiteBonus: true, dsaAchievementBonus: true,
          qoBonus: true, ebuActivationBonus: true, ebuRevenueShare: true,
        },
        _avg: { totalIncentive: true },
        _max: { totalIncentive: true },
        _count: true,
      }),
      prisma.shopManagerIncentiveCalculation.count({
        where: { incentivePeriodId: id, ...scopeWhere },
      }),
    ])

    // Compute readiness per input
    let readyShops = 0
    let incompleteShops = 0
    let atRiskShops = 0
    let calculatedShops = 0
    let staleCalculations = 0
    let salesComplete = 0
    let distributionComplete = 0
    let ebuComplete = 0

    for (const input of inputs) {
      const isStale = !!(input.calculation && input.calculation.calculatedAt && input.updatedAt > input.calculation.calculatedAt)

      const readiness = computeReadiness({
        shopCriteria: input.shopCriteria,
        shopManagerId: input.shopManagerId,
        qgaAbove90: input.qgaAbove90,
        qgaQuantity: input.qgaQuantity,
        mmQoAbove90: input.mmQoAbove90,
        dsaAirtimeAchievementPercent: input.dsaAirtimeAchievementPercent ? Number(input.dsaAirtimeAchievementPercent) : null,
        corridorStatus: input.corridorStatus,
        evdAbove100AndReconciled: input.evdAbove100AndReconciled,
        mpesaTargetAndReconciled: input.mpesaTargetAndReconciled,
        mpesaFloatSold: input.mpesaFloatSold ? Number(input.mpesaFloatSold) : null,
        baSite: input.baSite,
        ebuTargetAchieved: input.ebuTargetAchieved,
        ebuRevenueMade: input.ebuRevenueMade,
        ebuAverageTopupAbove500: input.ebuAverageTopupAbove500,
        ebuFirstMonthLfRevenue: input.ebuFirstMonthLfRevenue ? Number(input.ebuFirstMonthLfRevenue) : null,
        calculationExists: !!input.calculation,
        calculationStale: isStale,
      })

      if (readiness.readinessStatus === 'AT_RISK_ZERO') atRiskShops++
      else if (readiness.readinessStatus === 'INCOMPLETE') incompleteShops++
      else if (readiness.readinessStatus === 'READY') readyShops++
      else if (readiness.readinessStatus === 'CALCULATED') calculatedShops++
      else if (readiness.readinessStatus === 'STALE_CALCULATION') { staleCalculations++; calculatedShops++ }

      if (isStale && readiness.readinessStatus !== 'STALE_CALCULATION') staleCalculations++

      if (readiness.missingSalesFields.length === 0 && input.shopCriteria && input.shopCriteria !== 'AT_RISK') salesComplete++
      if (readiness.missingDistributionFields.length === 0 && input.shopCriteria && input.shopCriteria !== 'AT_RISK') distributionComplete++
      if (readiness.missingEbuFields.length === 0 && input.shopCriteria && input.shopCriteria !== 'AT_RISK') ebuComplete++
    }

    const totalShops = inputs.length
    const hasCalculations = staleCount > 0
    const payrollHandoffReady = period.status === 'CALCULATED' && staleCalculations === 0 && incompleteShops === 0

    const sums = calculationAgg._sum
    const max = calculationAgg._max
    const totalIncentive = Number(sums.totalIncentive) || 0

    return success({
      totalShops,
      readyShops,
      incompleteShops,
      atRiskShops,
      calculatedShops,
      staleCalculations,
      salesInputsComplete: salesComplete,
      distributionInputsComplete: distributionComplete,
      ebuInputsComplete: ebuComplete,
      totalIncentive,
      averageIncentive: totalShops > 0 ? Math.round((totalIncentive / totalShops) * 100) / 100 : 0,
      highestIncentive: Number(max.totalIncentive) || 0,
      hasCalculations,
      payrollHandoffReady,
      periodStatus: period.status,
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
