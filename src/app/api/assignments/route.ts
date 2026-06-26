import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth, badRequest, success } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  employeeId: z.string(),
  role: z.string(),
  level: z.string().optional(),
  departmentId: z.string().optional(),
  divisionId: z.string().optional(),
  regionId: z.string().optional(),
  shopId: z.string().optional(),
  clusterId: z.string().optional(),
  directManagerId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  reason: z.string().optional(),
})

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || ''

  const where: Record<string, unknown> = {}
  if (employeeId) where.employeeId = employeeId

  const assignments = await prisma.employeeAssignment.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeId: true, fullName: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  return success(assignments)
}, 'assignment.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const data = parsed.data

  // Close active assignment if exists
  await prisma.employeeAssignment.updateMany({
    where: { employeeId: data.employeeId, endDate: null },
    data: { endDate: new Date() },
  })

  const assignment = await prisma.employeeAssignment.create({
    data: {
      employeeId: data.employeeId,
      role: data.role as never,
      level: (data.level as never) || 'TO_BE_DEFINED',
      departmentId: data.departmentId || null,
      divisionId: data.divisionId || null,
      regionId: data.regionId || null,
      shopId: data.shopId || null,
      clusterId: data.clusterId || null,
      directManagerId: data.directManagerId || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      reason: data.reason || null,
    },
  })

  await createAuditLog({
    userId: ctx.userId,
    action: 'ASSIGNMENT_CHANGE',
    entityType: 'EmployeeAssignment',
    entityId: assignment.id,
    newValue: { employeeId: data.employeeId, role: data.role, startDate: data.startDate },
  })

  return success(assignment, 201)
}, 'assignment.update')
