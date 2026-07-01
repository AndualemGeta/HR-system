import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { assertEmployeeInUserScope } from '@/lib/payroll-scope'

const createWaiverSchema = z.object({
  employeeId: z.string().min(1),
  inputTypeId: z.string().min(1),
  reason: z.string().min(1, 'Waiver reason is required'),
  severity: z.enum(['BLOCKER', 'WARNING', 'INFO']).optional().default('WARNING'),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputWaiver.view'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    const whereClause: any = { payrollPeriodId: id, isActive: true }
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmps = await prisma.employee.findMany({ where: scopeWhere, select: { id: true } })
      whereClause.employeeId = { in: scopeEmps.map(e => e.id) }
    }
    const waivers = await prisma.payrollInputWaiver.findMany({
      where: whereClause,
      include: { employee: { select: { id: true, employeeId: true, fullName: true } }, inputType: { select: { id: true, code: true, name: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return success(waivers)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputWaiver.create'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    const body = await req.json().catch(() => ({}))
    const parsed = createWaiverSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const scopeCheck = await assertEmployeeInUserScope(session.userId, parsed.data.employeeId)
    if (!scopeCheck.allowed) return forbidden('Employee is outside your scope.')

    const isSelected = await prisma.payrollPeriodEmployee.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId: id, employeeId: parsed.data.employeeId } },
    })
    if (!isSelected || !isSelected.isSelected) return badRequest('Employee is not selected in this payroll period.')

    const inputType = await prisma.payrollInputType.findUnique({ where: { id: parsed.data.inputTypeId } })
    if (!inputType) return badRequest('Input type not found.')

    const existing = await prisma.payrollInputWaiver.findUnique({
      where: { payrollPeriodId_employeeId_inputTypeId: { payrollPeriodId: id, employeeId: parsed.data.employeeId, inputTypeId: parsed.data.inputTypeId } },
    })
    if (existing && existing.isActive) return badRequest('An active waiver already exists for this employee and input type.')
    const waiver = await prisma.payrollInputWaiver.create({
      data: { payrollPeriodId: id, employeeId: parsed.data.employeeId, inputTypeId: parsed.data.inputTypeId, reason: parsed.data.reason, severity: parsed.data.severity, createdById: session.userId },
      include: { employee: { select: { id: true, employeeId: true, fullName: true } }, inputType: { select: { id: true, code: true, name: true } } },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_WAIVER_CREATE', entityType: 'PayrollInputWaiver', entityId: waiver.id, newValue: parsed.data })
    return success(waiver)
  } catch (err) { console.error(err); return internalError() }
}
