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

    const [totalShops, eligibleShops, atRiskShops, missingCriteria, missingManager, calculationAgg, issueCounts, recentAuditLogs] = await Promise.all([
      prisma.shopManagerPerformanceInput.count({ where: { incentivePeriodId: id } }),
      prisma.shopManagerPerformanceInput.count({
        where: { incentivePeriodId: id, shopCriteria: { in: ['GOLD', 'SILVER', 'BRONZE'] } },
      }),
      prisma.shopManagerPerformanceInput.count({
        where: { incentivePeriodId: id, shopCriteria: 'AT_RISK' },
      }),
      prisma.shopManagerPerformanceInput.count({
        where: { incentivePeriodId: id, OR: [{ shopCriteria: null }, { shopCriteria: 'UNASSIGNED' }] },
      }),
      prisma.shopManagerPerformanceInput.count({
        where: { incentivePeriodId: id, shopManagerId: null },
      }),
      prisma.shopManagerIncentiveCalculation.aggregate({
        where: { incentivePeriodId: id },
        _sum: { totalAmount: true },
      }),
      prisma.shopManagerIncentiveIssue.groupBy({
        by: ['severity'],
        where: { incentivePeriodId: id },
        _count: true,
      }),
      prisma.auditLog.findMany({
        where: { entityType: 'ShopManagerIncentivePeriod', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ])

    const totalApprovedAgg = await prisma.shopManagerIncentiveCalculation.aggregate({
      where: { incentivePeriodId: id, status: 'APPROVED' },
      _sum: { totalAmount: true },
    })

    return success({
      totalShops,
      eligibleShops,
      atRiskShops,
      missingCriteria,
      missingManager,
      totalCalculated: Number(calculationAgg._sum.totalAmount) || 0,
      totalApproved: Number(totalApprovedAgg._sum.totalAmount) || 0,
      issueCounts: issueCounts.map(i => ({ severity: i.severity, count: i._count })),
      recentAuditLogs,
    })
  } catch (err) { console.error(err); return internalError() }
}
