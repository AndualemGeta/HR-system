import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth, success, badRequest } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const VALID_COMPONENT_TYPES = ['BASIC_SALARY', 'ALLOWANCE', 'KPI', 'TRANSPORT', 'OVERTIME', 'COMMISSION', 'BONUS', 'ADJUSTMENT', 'DEDUCTION', 'STATUTORY', 'OTHER'] as const
const VALID_TAX_TREATMENTS = ['TAXABLE', 'NON_TAXABLE', 'PARTIALLY_TAXABLE', 'STATUTORY', 'UNKNOWN'] as const
const VALID_DEDUCTION_TIMINGS = ['NOT_APPLICABLE', 'PRE_TAX', 'POST_TAX'] as const

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  componentType: z.enum(VALID_COMPONENT_TYPES).optional().default('OTHER'),
  taxTreatment: z.enum(VALID_TAX_TREATMENTS).optional().default('UNKNOWN'),
  isEarning: z.boolean().optional().default(true),
  isDeduction: z.boolean().optional().default(false),
  isStatutory: z.boolean().optional().default(false),
  isVariable: z.boolean().optional().default(false),
  isPensionable: z.boolean().optional().default(false),
  taxablePercent: z.number().min(0).max(100).optional().default(0),
  pensionablePercent: z.number().min(0).max(100).optional().default(0),
  affectsGross: z.boolean().optional().default(true),
  affectsNet: z.boolean().optional().default(true),
  affectsEmployerCost: z.boolean().optional().default(false),
  calculationOrder: z.number().int().min(0).optional().default(0),
  deductionTiming: z.enum(VALID_DEDUCTION_TIMINGS).optional().default('NOT_APPLICABLE'),
}).refine(d => !(d.isEarning && d.isDeduction), { message: 'isEarning and isDeduction cannot both be true' })
 .refine(d => !d.isDeduction || d.deductionTiming !== 'NOT_APPLICABLE', { message: 'Deduction components must have PRE_TAX or POST_TAX deductionTiming' })

export const GET = withAuth(async () => {
  const components = await prisma.payComponent.findMany({ orderBy: { code: 'asc' } })
  return success(components)
}, 'salaryStructure.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const data = parsed.data

  const existing = await prisma.payComponent.findUnique({ where: { code: data.code } })
  if (existing) return badRequest('Component code already exists')

  const component = await prisma.payComponent.create({
    data: {
      code: data.code, name: data.name,
      description: data.description || null,
      componentType: data.componentType,
      taxTreatment: data.taxTreatment,
      isEarning: data.isEarning,
      isDeduction: data.isDeduction,
      isStatutory: data.isStatutory,
      isVariable: data.isVariable,
      isPensionable: data.isPensionable,
      taxablePercent: data.taxablePercent,
      pensionablePercent: data.pensionablePercent,
      affectsGross: data.affectsGross,
      affectsNet: data.affectsNet,
      affectsEmployerCost: data.affectsEmployerCost,
      calculationOrder: data.calculationOrder,
      deductionTiming: data.deductionTiming,
      createdById: ctx.userId,
    },
  })

  await createAuditLog({
    userId: ctx.userId,
    action: 'PAY_COMPONENT_CREATE',
    entityType: 'PayComponent',
    entityId: component.id,
    newValue: { code: data.code, name: data.name, componentType: data.componentType },
  })

  return success(component, 201)
}, 'salaryStructure.manageComponents')
