import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, badRequest, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  endDate: z.string().optional(),
  reason: z.string().optional(),
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
    if (data.endDate) updateData.endDate = new Date(data.endDate)
    if (data.reason) updateData.reason = data.reason

    const assignment = await prisma.employeeAssignment.update({ where: { id }, data: updateData })

    await createAuditLog({
      userId: session.userId,
      action: 'ASSIGNMENT_CHANGE',
      entityType: 'EmployeeAssignment',
      entityId: id,
      oldValue: { endDate: existing.endDate },
      newValue: data,
    })

    return success(assignment)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
