import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const changeSchema = z.object({
  newAmount: z.number().min(0, 'Amount must be zero or greater'),
  newEffectiveFrom: z.string().min(1, 'newEffectiveFrom is required'),
  reason: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id, assignmentId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.update'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, employeeId: true, fullName: true } })
    if (!employee) return notFound()

    const existing = await prisma.employeePayComponentAssignment.findUnique({ where: { id: assignmentId } })
    if (!existing || existing.employeeId !== id) return notFound()
    if (!existing.isActive) return badRequest('Cannot change a deactivated assignment')

    const body = await req.json().catch(() => ({}))
    const parsed = changeSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { newAmount, newEffectiveFrom, reason } = parsed.data
    const newFrom = new Date(newEffectiveFrom)
    if (isNaN(newFrom.getTime())) return badRequest('Invalid newEffectiveFrom date')
    if (newFrom <= existing.effectiveFrom) return badRequest('New effective date must be after the current assignment start date')

    const kpiComponent = await prisma.payComponent.findUnique({ where: { code: 'KPI_ALLOWANCE' } })
    if (!kpiComponent) return badRequest('KPI component not found')

    // Check no overlap with other active assignments (excluding the one being closed)
    const overlapping = await prisma.employeePayComponentAssignment.findFirst({
      where: {
        employeeId: id,
        payComponentId: kpiComponent.id,
        isActive: true,
        id: { not: assignmentId },
        effectiveFrom: { lte: new Date('9999-12-31') },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: newFrom } },
        ],
      },
    })
    if (overlapping) return conflict('New effective date creates an overlap with another active assignment')

    // Close old, create new in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const closeDate = new Date(newFrom.getTime() - 86400000) // day before new effective
      await tx.employeePayComponentAssignment.update({
        where: { id: assignmentId },
        data: {
          effectiveTo: closeDate,
          updatedById: session.userId,
        },
      })

      const created = await tx.employeePayComponentAssignment.create({
        data: {
          employeeId: id,
          payComponentId: kpiComponent.id,
          defaultAmount: newAmount,
          effectiveFrom: newFrom,
          isActive: true,
          createdById: session.userId,
          updatedById: session.userId,
        },
      })

      return created
    })

    await createAuditLog({
      userId: session.userId,
      action: 'KPI_ASSIGNMENT_CHANGE',
      entityType: 'EmployeePayComponentAssignment',
      entityId: result.id,
      newValue: {
        employeeId: id,
        employeeCode: employee.employeeId,
        fullName: employee.fullName,
        component: 'KPI_ALLOWANCE',
        previousAssignmentId: assignmentId,
        previousAmount: Number(existing.defaultAmount),
        previousEffectiveFrom: existing.effectiveFrom.toISOString().split('T')[0],
        previousEffectiveTo: existing.effectiveTo?.toISOString().split('T')[0] || null,
        newAmount,
        newEffectiveFrom: newEffectiveFrom,
        reason: reason || 'Amount change',
      },
    })

    return success({
      id: result.id,
      payComponentCode: 'KPI_ALLOWANCE',
      defaultAmount: Number(result.defaultAmount),
      effectiveFrom: result.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: result.effectiveTo?.toISOString().split('T')[0] || null,
      isActive: result.isActive,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    })
  } catch (err) { console.error(err); return internalError() }
}
