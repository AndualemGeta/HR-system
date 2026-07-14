import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success, badRequest } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export const GET = withAuth(async () => {
  const components = await prisma.payComponent.findMany({ orderBy: { code: 'asc' } })
  return success(components)
}, 'salaryStructure.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const { code, name, description, componentType, taxTreatment, isEarning, isDeduction, isStatutory, isVariable, isPensionable, taxablePercent, pensionablePercent, affectsGross, affectsNet, affectsEmployerCost, calculationOrder } = body

  if (!code || !name) return badRequest('Code and name are required')

  const existing = await prisma.payComponent.findUnique({ where: { code } })
  if (existing) return badRequest('Component code already exists')

  const component = await prisma.payComponent.create({
    data: {
      code, name,
      description: description || null,
      componentType: componentType || 'OTHER',
      taxTreatment: taxTreatment || 'UNKNOWN',
      isEarning: isEarning ?? true,
      isDeduction: isDeduction ?? false,
      isStatutory: isStatutory ?? false,
      isVariable: isVariable ?? false,
      isPensionable: isPensionable ?? false,
      taxablePercent: taxablePercent ?? 0,
      pensionablePercent: pensionablePercent ?? 0,
      affectsGross: affectsGross ?? true,
      affectsNet: affectsNet ?? true,
      affectsEmployerCost: affectsEmployerCost ?? false,
      calculationOrder: calculationOrder ?? 0,
      createdById: ctx.userId,
    },
  })

  await createAuditLog({
    userId: ctx.userId,
    action: 'PAY_COMPONENT_CREATE',
    entityType: 'PayComponent',
    entityId: component.id,
    newValue: { code, name, componentType },
  })

  return success(component, 201)
}, 'salaryStructure.manageComponents')
