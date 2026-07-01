import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  employeeId: z.string().min(1),
  inputTypeId: z.string().min(1),
  value: z.number().optional(),
  amount: z.number().optional(),
  note: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.view'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true } })
    if (!period) return notFound('Payroll period not found')

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const inputTypeId = searchParams.get('inputTypeId')
    const status = searchParams.get('status')
    const departmentId = searchParams.get('departmentId')
    const areaId = searchParams.get('areaId')
    const shopId = searchParams.get('shopId')

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)

    const where: Record<string, unknown> = { payrollPeriodId: id }
    if (employeeId) where.employeeId = employeeId
    if (inputTypeId) where.inputTypeId = inputTypeId
    if (status) where.status = status

    const employeeWhere: Record<string, unknown> = { ...scopeWhere }
    if (departmentId) employeeWhere.currentDepartmentId = departmentId
    if (areaId) employeeWhere.currentAreaId = areaId
    if (shopId) employeeWhere.currentShopId = shopId
    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere
    }

    const inputs = await prisma.payrollInput.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeId: true, fullName: true, currentDepartmentId: true } },
        inputType: { select: { id: true, code: true, name: true, category: true, valueType: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return success(inputs)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.create'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'OPEN_FOR_INPUT') return badRequest('Inputs can only be created in OPEN_FOR_INPUT periods')

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { employeeId, inputTypeId, value, amount, note } = parsed.data

    const isSelected = await prisma.payrollPeriodEmployee.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId: id, employeeId } },
    })
    if (!isSelected || !isSelected.isSelected) return badRequest('Employee is not selected in this payroll period')

    const inputType = await prisma.payrollInputType.findUnique({ where: { id: inputTypeId } })
    if (!inputType) return badRequest('Input type not found')
    if (!inputType.isActive) return badRequest('Input type is not active')

    const existing = await prisma.payrollInput.findUnique({
      where: { payrollPeriodId_employeeId_inputTypeId: { payrollPeriodId: id, employeeId, inputTypeId } },
    })
    if (existing) return conflict('An input record already exists for this employee and input type in this period. Use import modes to update existing records.')

    const input = await prisma.payrollInput.create({
      data: {
        payrollPeriodId: id,
        employeeId,
        inputTypeId,
        value: value !== undefined ? value : null,
        amount: amount !== undefined ? amount : null,
        note,
        source: 'MANUAL',
        status: 'DRAFT',
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_CREATE',
      entityType: 'PayrollInput',
      entityId: input.id,
      newValue: { employeeId, inputTypeId, value, amount },
    })

    return success(input, 201)
  } catch (err) { console.error(err); return internalError() }
}
