import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'

const HEADERS = [
  'shopCode',
  'shopName',
  'shopManagerEmployeeId',
  'qgaAchievementPercent',
  'qgaCount',
  'evdAchievementPercent',
  'evdReconciled',
  'baSiteRequirementMet',
  'mpesaFloatSold',
  'mpesaTargetAchieved',
  'mpesaReconciled',
  'dsaAirtimeAchievementPercent',
  'mmQoTargetPercent',
  'ebuTargetAchieved',
  'ebuRevenue',
  'ebuAverageTopup',
  'ebuFirstMonthLeapfrogRevenue',
  'notes',
]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.import'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const csvContent = HEADERS.join(',') + '\n'

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shop-manager-incentives-import-${period.name.replace(/\s+/g, '-')}.csv"`,
      },
    })
  } catch (err) { console.error(err); return internalError() }
}
