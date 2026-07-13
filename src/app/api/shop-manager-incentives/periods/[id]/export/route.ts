import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { buildIncentiveScopeWhere } from '@/lib/incentive-scope'

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const EXPORT_HEADERS = [
  'periodName',
  'shopCode',
  'shopName',
  'shopManagerName',
  'criteria',
  'qgaBonus',
  'qgaSimCommission',
  'evdBonus',
  'mpesaCommission',
  'baSiteBonus',
  'dsaAchievementBonus',
  'qoBonus',
  'ebuActivationBonus',
  'ebuRevenueShare',
  'totalIncentive',
  'calculationNote',
]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.export'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const scopeWhere = await buildIncentiveScopeWhere(session.userId)
    const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
      where: { incentivePeriodId: id, ...scopeWhere },
      include: {
        shopLocation: { select: { id: true, code: true, name: true } },
        shopManager: { select: { id: true, fullName: true } },
      },
      orderBy: { shopLocation: { code: 'asc' } },
    })

    const lines: string[] = [EXPORT_HEADERS.join(',')]

    for (const calc of calculations) {
      const row = [
        period.name,
        calc.shopLocation.code,
        calc.shopLocation.name,
        calc.shopManager?.fullName || '',
        calc.shopCriteria || '',
        calc.qgaBonus || 0,
        calc.qgaSimCommission || 0,
        calc.evdBonus || 0,
        calc.mpesaCommission || 0,
        calc.baSiteBonus || 0,
        calc.dsaAchievementBonus || 0,
        calc.qoBonus || 0,
        calc.ebuActivationBonus || 0,
        calc.ebuRevenueShare || 0,
        calc.totalIncentive || 0,
        calc.calculationNote || '',
      ]

      lines.push(row.map(v => escapeCsv(v)).join(','))
    }

    const csvContent = lines.join('\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shop-manager-incentives-export-${period.name.replace(/\s+/g, '-')}.csv"`,
      },
    })
  } catch (err) { console.error(err); return internalError() }
}
