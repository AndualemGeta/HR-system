import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  periodName: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  payDate: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const periods = await prisma.payrollPeriod.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      include: {
        _count: { select: { employees: { where: { isSelected: true } }, inputs: true } },
      },
    })

    return success(periods)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.create'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { periodName, periodStart, periodEnd, payDate } = parsed.data

    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    const pay = new Date(payDate)

    if (isNaN(start.getTime())) return badRequest('Invalid periodStart date')
    if (isNaN(end.getTime())) return badRequest('Invalid periodEnd date')
    if (isNaN(pay.getTime())) return badRequest('Invalid payDate date')
    if (end < start) return badRequest('periodEnd cannot be before periodStart')
    if (pay < end) return badRequest('payDate cannot be before periodEnd. If this is intentional, acknowledge the warning.')

    const period = await prisma.payrollPeriod.create({
      data: {
        periodName,
        periodStart: start,
        periodEnd: end,
        payDate: pay,
        createdById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PERIOD_CREATE',
      entityType: 'PayrollPeriod',
      entityId: period.id,
      newValue: { periodName, periodStart, periodEnd, payDate },
    })

    return success(period, 201)
  } catch (err) { console.error(err); return internalError() }
}
