import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  payrollPeriodId: z.string(),
  name: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [total, periods] = await Promise.all([
      prisma.shopManagerIncentivePeriod.count({ where }),
      prisma.shopManagerIncentivePeriod.findMany({
        where,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          payrollPeriod: { select: { id: true, periodName: true } },
          _count: {
            select: {
              performanceInputs: true,
              calculations: true,
              issues: true,
            },
          },
        },
      }),
    ])

    const periodIds = periods.map(p => p.id)

    const calculationSums = await prisma.shopManagerIncentiveCalculation.groupBy({
      by: ['incentivePeriodId'],
      where: { incentivePeriodId: { in: periodIds } },
      _sum: { totalAmount: true },
    })

    const approvedSums = await prisma.shopManagerIncentiveCalculation.groupBy({
      by: ['incentivePeriodId'],
      where: { incentivePeriodId: { in: periodIds }, status: 'APPROVED' },
      _sum: { totalAmount: true },
    })

    const calcSumMap = new Map(calculationSums.map(c => [c.incentivePeriodId, Number(c._sum.totalAmount) || 0]))
    const approvedSumMap = new Map(approvedSums.map(c => [c.incentivePeriodId, Number(c._sum.totalAmount) || 0]))

    const data = periods.map(p => ({
      id: p.id,
      name: p.name,
      month: p.month,
      year: p.year,
      status: p.status,
      notes: p.notes,
      totalShops: p._count.performanceInputs,
      totalCalculatedAmount: calcSumMap.get(p.id) ?? 0,
      totalApprovedAmount: approvedSumMap.get(p.id) ?? 0,
      createdBy: p.createdBy,
      payrollPeriod: p.payrollPeriod,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))

    return success({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.createPeriod'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { payrollPeriodId, name, month, year, notes } = parsed.data

    const payrollPeriod = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
    if (!payrollPeriod) return notFound('Payroll period not found')

    const existing = await prisma.shopManagerIncentivePeriod.findUnique({ where: { payrollPeriodId } })
    if (existing) return conflict('An incentive period already exists for this payroll period')

    const period = await prisma.shopManagerIncentivePeriod.create({
      data: {
        payrollPeriodId,
        name,
        month,
        year,
        notes,
        status: 'DRAFT',
        createdById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_PERIOD_CREATE',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: period.id,
      newValue: { payrollPeriodId, name, month, year, notes },
    })

    return success(period, 201)
  } catch (err) { console.error(err); return internalError() }
}
