import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { computeReadiness } from '@/lib/shop-manager-incentives'

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

    const inputs = await prisma.shopManagerIncentiveInput.findMany({
      where: { incentivePeriodId: id },
      include: {
        shopLocation: {
          select: { id: true, name: true, code: true },
        },
        shopManager: {
          select: { id: true, fullName: true, employeeId: true },
        },
        calculation: {
          select: { calculatedAt: true },
        },
      },
    })

    const items = inputs.map((input) => {
      const calculationStale = !!(
        input.calculation?.calculatedAt &&
        input.updatedAt > input.calculation.calculatedAt
      )

      const readiness = computeReadiness({
        shopCriteria: input.shopCriteria,
        shopManagerId: input.shopManagerId,
        qgaAbove90: input.qgaAbove90,
        qgaQuantity: input.qgaQuantity,
        mmQoAbove90: input.mmQoAbove90,
        dsaAirtimeAchievementPercent: input.dsaAirtimeAchievementPercent
          ? Number(input.dsaAirtimeAchievementPercent) : null,
        corridorStatus: input.corridorStatus,
        evdAbove100AndReconciled: input.evdAbove100AndReconciled,
        mpesaTargetAndReconciled: input.mpesaTargetAndReconciled,
        mpesaFloatSold: input.mpesaFloatSold ? Number(input.mpesaFloatSold) : null,
        baSite: input.baSite,
        ebuTargetAchieved: input.ebuTargetAchieved,
        ebuRevenueMade: input.ebuRevenueMade,
        ebuAverageTopupAbove500: input.ebuAverageTopupAbove500,
        ebuFirstMonthLfRevenue: input.ebuFirstMonthLfRevenue
          ? Number(input.ebuFirstMonthLfRevenue) : null,
        calculationExists: !!input.calculation,
        calculationStale,
      })

      return {
        inputId: input.id,
        shopLocationId: input.shopLocationId,
        shopLocation: input.shopLocation,
        shopManager: input.shopManager,
        shopCriteria: input.shopCriteria,
        ...readiness,
      }
    })

    const summary = {
      total: items.length,
      ready: items.filter(i => i.readinessStatus === 'READY').length,
      incomplete: items.filter(i => i.readinessStatus === 'INCOMPLETE').length,
      atRiskZero: items.filter(i => i.readinessStatus === 'AT_RISK_ZERO').length,
      calculated: items.filter(i => i.readinessStatus === 'CALCULATED').length,
      staleCalculation: items.filter(i => i.readinessStatus === 'STALE_CALCULATION').length,
    }

    return success({ summary, inputs: items })
  } catch (err) { console.error(err); return internalError() }
}
