import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { badRequest } from '@/lib/api'

const createSchema = z.object({
  employeeId: z.string(),
  newStatus: z.string(),
  reason: z.string().min(1),
  effectiveDate: z.string().optional(),
})

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || ''

  const where: Record<string, unknown> = {}
  if (employeeId) where.employeeId = employeeId

  const history = await prisma.employeeStatusHistory.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeId: true, fullName: true } },
    },
    orderBy: { effectiveDate: 'desc' },
  })

  return success(history)
}, 'status.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const data = parsed.data
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } })
  if (!employee) return badRequest('Employee not found')

  const previousStatus = employee.employmentStatus

  const history = await prisma.employeeStatusHistory.create({
    data: {
      employeeId: data.employeeId,
      previousStatus,
      newStatus: data.newStatus as never,
      reason: data.reason,
      effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
      updatedById: ctx.userId,
    },
  })

  await prisma.employee.update({
    where: { id: data.employeeId },
    data: { employmentStatus: data.newStatus as never, updatedById: ctx.userId },
  })

  await createAuditLog({
    userId: ctx.userId,
    action: 'EMPLOYEE_STATUS_CHANGE',
    entityType: 'Employee',
    entityId: data.employeeId,
    oldValue: { employmentStatus: previousStatus },
    newValue: { employmentStatus: data.newStatus },
  })

  return success(history, 201)
}, 'status.update')
