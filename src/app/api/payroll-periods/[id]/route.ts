import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  periodName: z.string().min(1).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  payDate: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: { where: { isSelected: true } },
            inputs: true,
          },
        },
      },
    })
    if (!period) return notFound('Payroll period not found')

    const inputsByStatus = await prisma.payrollInput.groupBy({
      by: ['status'],
      where: { payrollPeriodId: id },
      _count: true,
    })

    return success({
      ...period,
      inputsByStatus: inputsByStatus.reduce((acc, row) => {
        acc[row.status] = row._count
        return acc
      }, {} as Record<string, number>),
    })
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')

    if (period.status !== 'DRAFT') return badRequest('Only DRAFT periods can be edited')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { periodName, periodStart, periodEnd, payDate } = parsed.data

    const updateData: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}

    if (periodName !== undefined) {
      updateData.periodName = periodName
      newValues.periodName = periodName
      oldValues.periodName = period.periodName
    }
    if (periodStart !== undefined) {
      const d = new Date(periodStart)
      if (isNaN(d.getTime())) return badRequest('Invalid periodStart date')
      updateData.periodStart = d
      newValues.periodStart = periodStart
      oldValues.periodStart = period.periodStart.toISOString()
    }
    if (periodEnd !== undefined) {
      const d = new Date(periodEnd)
      if (isNaN(d.getTime())) return badRequest('Invalid periodEnd date')
      updateData.periodEnd = d
      newValues.periodEnd = periodEnd
      oldValues.periodEnd = period.periodEnd.toISOString()
    }
    if (payDate !== undefined) {
      const d = new Date(payDate)
      if (isNaN(d.getTime())) return badRequest('Invalid payDate date')
      updateData.payDate = d
      newValues.payDate = payDate
      oldValues.payDate = period.payDate.toISOString()
    }

    if (updateData.periodStart && updateData.periodEnd) {
      if (updateData.periodEnd < updateData.periodStart) return badRequest('periodEnd cannot be before periodStart')
    } else if (updateData.periodStart && !updateData.periodEnd) {
      if (period.periodEnd < updateData.periodStart) return badRequest('periodEnd cannot be before periodStart')
    } else if (!updateData.periodStart && updateData.periodEnd) {
      if (updateData.periodEnd < period.periodStart) return badRequest('periodEnd cannot be before periodStart')
    }

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: { ...updateData, updatedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PERIOD_UPDATE',
      entityType: 'PayrollPeriod',
      entityId: id,
      oldValue: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValue: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
