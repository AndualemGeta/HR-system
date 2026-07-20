import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const deactivateSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
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

    // Check no approved payroll calculations reference this assignment
    const approvedLines = await prisma.payrollCalculationLine.findFirst({
      where: {
        employeeId: id,
        componentId: existing.payComponentId,
        batch: { status: 'APPROVED' },
      },
    })
    if (approvedLines) {
      return badRequest('Cannot deactivate assignment that has already been used in approved payroll calculations')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = deactivateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const updated = await prisma.employeePayComponentAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        updatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'KPI_ASSIGNMENT_DEACTIVATE',
      entityType: 'EmployeePayComponentAssignment',
      entityId: assignmentId,
      oldValue: { isActive: true, defaultAmount: Number(existing.defaultAmount), effectiveFrom: existing.effectiveFrom.toISOString() },
      newValue: { isActive: false, reason: parsed.data.reason },
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
