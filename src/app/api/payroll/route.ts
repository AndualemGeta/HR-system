import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [periods, total] = await Promise.all([
      prisma.mvpPayrollPeriod.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip,
        take: limit,
        include: { _count: { select: { rows: true } } },
      }),
      prisma.mvpPayrollPeriod.count(),
    ])

    return success({ items: periods, total, page, limit })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.create'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const { month, year, payDate } = body
    if (!month || !year) return badRequest('Month and year are required')

    const monthNum = parseInt(month)
    const yearNum = parseInt(year)
    if (monthNum < 1 || monthNum > 12) return badRequest('Month must be 1-12')
    if (yearNum < 2020) return badRequest('Invalid year')

    // Check duplicate
    const existing = await prisma.mvpPayrollPeriod.findUnique({
      where: { month_year: { month: monthNum, year: yearNum } },
    })
    if (existing) return badRequest(`Payroll period for ${monthNum}/${yearNum} already exists`)

    const periodStart = new Date(yearNum, monthNum - 1, 1)
    const periodEnd = new Date(yearNum, monthNum, 0, 23, 59, 59)

    const period = await prisma.mvpPayrollPeriod.create({
      data: {
        month: monthNum,
        year: yearNum,
        periodName: `${yearNum}-${String(monthNum).padStart(2, '0')}`,
        periodStart,
        periodEnd,
        payDate: payDate ? new Date(payDate) : periodEnd,
        createdById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PERIOD_CREATE',
      entityType: 'MvpPayrollPeriod',
      entityId: period.id,
      newValue: { month: monthNum, year: yearNum },
    })

    return success(period, 201)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
