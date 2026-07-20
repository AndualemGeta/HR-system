import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const CALCULATION_MODES = ['DIRECT_AMOUNT', 'METRIC_ONLY', 'RULE_DERIVED'] as const

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(['ALLOWANCE', 'DEDUCTION', 'COMMISSION', 'KPI', 'TRANSPORT', 'OVERTIME', 'BONUS', 'ADJUSTMENT', 'OTHER']).optional(),
  valueType: z.enum(['AMOUNT', 'NUMBER', 'PERCENTAGE', 'BOOLEAN', 'TEXT']).optional(),
  calculationMode: z.enum(CALCULATION_MODES).optional(),
  defaultAmount: z.number().nullable().optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputType.view'))) return forbidden()

    const inputType = await prisma.payrollInputType.findUnique({ where: { id } })
    if (!inputType) return notFound('Input type not found')

    return success(inputType)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputType.manage'))) return forbidden()

    const existing = await prisma.payrollInputType.findUnique({ where: { id } })
    if (!existing) return notFound('Input type not found')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { name, description, category, valueType, calculationMode, defaultAmount, requiresApproval, isActive } = parsed.data

    const updateData: Record<string, unknown> = { updatedById: session.userId }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category
    if (valueType !== undefined) updateData.valueType = valueType
    if (calculationMode !== undefined) updateData.calculationMode = calculationMode
    if (defaultAmount !== undefined) updateData.defaultAmount = defaultAmount
    if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await prisma.payrollInputType.update({
      where: { id },
      data: updateData,
    })

    const auditAction = isActive === false ? 'PAYROLL_INPUT_TYPE_DEACTIVATE' : 'PAYROLL_INPUT_TYPE_UPDATE'

    await createAuditLog({
      userId: session.userId,
      action: auditAction as never,
      entityType: 'PayrollInputType',
      entityId: id,
      oldValue: { name: existing.name, isActive: existing.isActive },
      newValue: { name: updated.name, isActive: updated.isActive },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
