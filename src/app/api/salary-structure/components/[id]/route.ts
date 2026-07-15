import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const VALID_COMPONENT_TYPES = ['BASIC_SALARY', 'ALLOWANCE', 'KPI', 'TRANSPORT', 'OVERTIME', 'COMMISSION', 'BONUS', 'ADJUSTMENT', 'DEDUCTION', 'STATUTORY', 'OTHER'] as const
const VALID_TAX_TREATMENTS = ['TAXABLE', 'NON_TAXABLE', 'PARTIALLY_TAXABLE', 'STATUTORY', 'UNKNOWN'] as const
const VALID_DEDUCTION_TIMINGS = ['NOT_APPLICABLE', 'PRE_TAX', 'POST_TAX'] as const

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  componentType: z.enum(VALID_COMPONENT_TYPES).optional(),
  taxTreatment: z.enum(VALID_TAX_TREATMENTS).optional(),
  isEarning: z.boolean().optional(),
  isDeduction: z.boolean().optional(),
  isStatutory: z.boolean().optional(),
  isVariable: z.boolean().optional(),
  isPensionable: z.boolean().optional(),
  taxablePercent: z.number().min(0).max(100).optional(),
  pensionablePercent: z.number().min(0).max(100).optional(),
  affectsGross: z.boolean().optional(),
  affectsNet: z.boolean().optional(),
  affectsEmployerCost: z.boolean().optional(),
  calculationOrder: z.number().int().min(0).optional(),
  deductionTiming: z.enum(VALID_DEDUCTION_TIMINGS).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.view'))) return forbidden()

    const component = await prisma.payComponent.findUnique({ where: { id } })
    if (!component) return notFound('Component not found')
    return success(component)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.manageComponents'))) return forbidden()

    const component = await prisma.payComponent.findUnique({ where: { id } })
    if (!component) return notFound('Component not found')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data

    const updated = await prisma.payComponent.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.componentType !== undefined && { componentType: data.componentType }),
        ...(data.taxTreatment !== undefined && { taxTreatment: data.taxTreatment }),
        ...(data.isEarning !== undefined && { isEarning: data.isEarning }),
        ...(data.isDeduction !== undefined && { isDeduction: data.isDeduction }),
        ...(data.isStatutory !== undefined && { isStatutory: data.isStatutory }),
        ...(data.isVariable !== undefined && { isVariable: data.isVariable }),
        ...(data.isPensionable !== undefined && { isPensionable: data.isPensionable }),
        ...(data.taxablePercent !== undefined && { taxablePercent: data.taxablePercent }),
        ...(data.pensionablePercent !== undefined && { pensionablePercent: data.pensionablePercent }),
        ...(data.affectsGross !== undefined && { affectsGross: data.affectsGross }),
        ...(data.affectsNet !== undefined && { affectsNet: data.affectsNet }),
        ...(data.affectsEmployerCost !== undefined && { affectsEmployerCost: data.affectsEmployerCost }),
        ...(data.calculationOrder !== undefined && { calculationOrder: data.calculationOrder }),
        ...(data.deductionTiming !== undefined && { deductionTiming: data.deductionTiming }),
        updatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAY_COMPONENT_UPDATE',
      entityType: 'PayComponent',
      entityId: id,
      oldValue: { name: component.name, componentType: component.componentType },
      newValue: { name: updated.name, componentType: updated.componentType },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
