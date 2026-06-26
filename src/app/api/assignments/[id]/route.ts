import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, badRequest, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  role: z.string().optional(),
  level: z.string().optional(),
  employeeCategory: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  regionId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  shopId: z.string().nullable().optional(),
  clusterId: z.string().nullable().optional(),
  directManagerId: z.string().nullable().optional(),
  accountingReportingManagerId: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'assignment.update'))) return forbidden()

    const existing = await prisma.employeeAssignment.findUnique({ where: { id } })
    if (!existing) return notFound()

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    const stringFields = ['role', 'level', 'employeeCategory', 'departmentId', 'divisionId', 'regionId', 'areaId', 'shopId', 'clusterId', 'directManagerId', 'accountingReportingManagerId', 'reason'] as const
    for (const field of stringFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field] === null ? null : data[field]
      }
    }
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // If level is empty string, default to TO_BE_DEFINED
    if (updateData.level === '') updateData.level = 'TO_BE_DEFINED'

    const assignment = await prisma.employeeAssignment.update({ where: { id }, data: updateData })

    await createAuditLog({
      userId: session.userId,
      action: 'ASSIGNMENT_CHANGE',
      entityType: 'EmployeeAssignment',
      entityId: id,
      oldValue: { role: existing.role, level: existing.level, endDate: existing.endDate, reason: existing.reason },
      newValue: { role: updateData.role, level: updateData.level, endDate: updateData.endDate, reason: updateData.reason },
    })

    return success(assignment)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
