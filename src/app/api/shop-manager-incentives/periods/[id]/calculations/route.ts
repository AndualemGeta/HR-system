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
      incentivePeriodId: c.incentivePeriodId,
      shopLocationId: c.shopLocationId,
      shopLocation: c.shopLocation,
      shopManager: c.shopManager,
      shopCriteria: c.shopCriteria,
      qgaBonus: Number(c.qgaBonus ?? 0),
      qgaSimCommission: Number(c.qgaSimCommission ?? 0),
      evdBonus: Number(c.evdBonus ?? 0),
      mpesaCommission: Number(c.mpesaCommission ?? 0),
      baSiteBonus: Number(c.baSiteBonus ?? 0),
      dsaAchievementBonus: Number(c.dsaAchievementBonus ?? 0),
      qoBonus: Number(c.qoBonus ?? 0),
      ebuActivationBonus: Number(c.ebuActivationBonus ?? 0),
      ebuRevenueShare: Number(c.ebuRevenueShare ?? 0),
      totalIncentive: Number(c.totalIncentive ?? 0),
      calculationNote: c.calculationNote,
      calculatedAt: c.calculatedAt,
    }))

    return success(data)
  } catch (err) { console.error(err); return internalError() }
}
