import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const closeSchema = z.object({
  effectiveTo: z.string().min(1, 'effectiveTo is required'),
  reason: z.string().min(1, 'reason is required'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id, assignmentId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.update'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const existing = await prisma.employeePayComponentAssignment.findUnique({ where: { id: assignmentId } })
    if (!existing || existing.employeeId !== id) return notFound()
    if (!existing.isActive) return badRequest('Assignment is already deactivated')
    if (existing.effectiveTo) return badRequest('Assignment is already closed')

    const body = await req.json().catch(() => ({}))
    const parsed = closeSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const effectiveTo = new Date(parsed.data.effectiveTo)
    if (isNaN(effectiveTo.getTime())) return badRequest('Invalid effectiveTo date')
    if (effectiveTo < existing.effectiveFrom) return badRequest('effectiveTo cannot be before effectiveFrom')

    const updated = await prisma.employeePayComponentAssignment.update({
      where: { id: assignmentId },
      data: {
        effectiveTo,
        updatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'KPI_ASSIGNMENT_CLOSE',
      entityType: 'EmployeePayComponentAssignment',
      entityId: assignmentId,
      oldValue: { effectiveTo: null },
      newValue: { effectiveTo: parsed.data.effectiveTo, reason: parsed.data.reason },
    })

    return success({
      id: updated.id,
      payComponentCode: 'KPI_ALLOWANCE',
      defaultAmount: Number(updated.defaultAmount),
      effectiveFrom: updated.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: updated.effectiveTo?.toISOString().split('T')[0] || null,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (err) { console.error(err); return internalError() }
}
