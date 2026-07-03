import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'

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
  'shopCriteria',
  'corridorType',
  'QGA_Bonus',
  'QGA_SIM_Commission',
  'EVD_Bonus',
  'BA_Site_Bonus',
  'MPESA_Commission',
  'DSA_Achievement_Bonus',
  'QO_Bonus',
  'EBU_Activation_Bonus',
  'EBU_Revenue_Share',
  'Total',
  'Status',
]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.export'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
      where: { incentivePeriodId: id },
      include: {
        shopLocation: {
          include: { shopProfile: true },
        },
        shopManager: { select: { employeeId: true, fullName: true } },
        components: true,
      },
      orderBy: { shopLocation: { code: 'asc' } },
    })

    const lines: string[] = [EXPORT_HEADERS.join(',')]

    for (const calc of calculations) {
      const compMap = new Map<string, number>()
      for (const comp of calc.components) {
        compMap.set(comp.componentCode, Number(comp.amount))
      }

      const row = [
        period.name,
        calc.shopLocation.code,
        calc.shopLocation.name,
        calc.shopManager?.fullName || '',
        calc.shopCriteria || '',
        calc.shopLocation.shopProfile?.corridorType || '',
        compMap.get('QGA_BONUS') || 0,
        compMap.get('QGA_SIM_COMMISSION') || 0,
        compMap.get('EVD_BONUS') || 0,
        compMap.get('BA_SITE_BONUS') || 0,
        compMap.get('MPESA_COMMISSION') || 0,
        compMap.get('DSA_ACHIEVEMENT_BONUS') || 0,
        compMap.get('QO_BONUS') || 0,
        compMap.get('EBU_ACTIVATION_BONUS') || 0,
        compMap.get('EBU_REVENUE_SHARE') || 0,
        Number(calc.totalAmount || 0),
        calc.status,
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
