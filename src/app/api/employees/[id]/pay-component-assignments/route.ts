import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const KPI_COMPONENT_CODE = 'KPI_ALLOWANCE'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } })
    if (!employee) return notFound()

    const kpiComponent = await prisma.payComponent.findUnique({ where: { code: KPI_COMPONENT_CODE } })
    if (!kpiComponent) return success({ employeeId: id, currentAssignment: null, assignments: [] })

    const assignments = await prisma.employeePayComponentAssignment.findMany({
      where: { employeeId: id, payComponentId: kpiComponent.id },
      orderBy: { effectiveFrom: 'desc' },
    })

    const now = new Date()
    const currentAssignment = assignments.find(a => a.isActive && (!a.effectiveTo || a.effectiveTo >= now) && a.effectiveFrom <= now) || null

    return success({
      employeeId: id,
      currentAssignment: currentAssignment ? {
        id: currentAssignment.id,
        payComponentCode: KPI_COMPONENT_CODE,
        defaultAmount: Number(currentAssignment.defaultAmount),
        effectiveFrom: currentAssignment.effectiveFrom.toISOString().split('T')[0],
        effectiveTo: currentAssignment.effectiveTo?.toISOString().split('T')[0] || null,
        isActive: currentAssignment.isActive,
        createdAt: currentAssignment.createdAt.toISOString(),
        updatedAt: currentAssignment.updatedAt.toISOString(),
      } : null,
      assignments: assignments.map(a => ({
        id: a.id,
        payComponentCode: KPI_COMPONENT_CODE,
        defaultAmount: Number(a.defaultAmount),
        effectiveFrom: a.effectiveFrom.toISOString().split('T')[0],
        effectiveTo: a.effectiveTo?.toISOString().split('T')[0] || null,
        isActive: a.isActive,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    })
  } catch (err) { console.error(err); return internalError() }
}

const createSchema = z.object({
  payComponentCode: z.literal(KPI_COMPONENT_CODE),
  defaultAmount: z.number().min(0, 'defaultAmount must be zero or greater'),
  effectiveFrom: z.string().min(1, 'effectiveFrom is required'),
  effectiveTo: z.string().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.update'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, employeeId: true, fullName: true } })
    if (!employee) return notFound()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data

    const kpiComponent = await prisma.payComponent.findUnique({ where: { code: KPI_COMPONENT_CODE } })
    if (!kpiComponent) return badRequest('KPI component not found')
    if (!kpiComponent.isActive) return badRequest('KPI component is inactive')
    if (kpiComponent.componentType !== 'KPI') return badRequest('Component is not a KPI type')

    const effectiveFrom = new Date(data.effectiveFrom)
    if (isNaN(effectiveFrom.getTime())) return badRequest('Invalid effectiveFrom date')

    let effectiveTo: Date | null = null
    if (data.effectiveTo) {
      effectiveTo = new Date(data.effectiveTo)
      if (isNaN(effectiveTo.getTime())) return badRequest('Invalid effectiveTo date')
      if (effectiveTo < effectiveFrom) return badRequest('effectiveTo cannot be before effectiveFrom')
    }

    // Check overlapping active assignment
    const overlapping = await prisma.employeePayComponentAssignment.findFirst({
      where: {
        employeeId: id,
        payComponentId: kpiComponent.id,
        isActive: true,
        effectiveFrom: { lte: effectiveTo || new Date('9999-12-31') },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveFrom } },
        ],
      },
    })
    if (overlapping) {
      return conflict('Overlapping active KPI assignment exists')
    }

    const assignment = await prisma.employeePayComponentAssignment.create({
      data: {
        employeeId: id,
        payComponentId: kpiComponent.id,
        defaultAmount: data.defaultAmount,
        effectiveFrom,
        effectiveTo,
        isActive: true,
        createdById: session.userId,
        updatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'KPI_ASSIGNMENT_CREATE',
      entityType: 'EmployeePayComponentAssignment',
      entityId: assignment.id,
      newValue: {
        employeeId: id,
        employeeCode: employee.employeeId,
        fullName: employee.fullName,
        component: KPI_COMPONENT_CODE,
        defaultAmount: data.defaultAmount,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || null,
      },
    })

    return success({
      id: assignment.id,
      payComponentCode: KPI_COMPONENT_CODE,
      defaultAmount: Number(assignment.defaultAmount),
      effectiveFrom: assignment.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: assignment.effectiveTo?.toISOString().split('T')[0] || null,
      isActive: assignment.isActive,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    }, 201)
  } catch (err) { console.error(err); return internalError() }
}
