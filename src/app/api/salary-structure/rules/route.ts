import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success, badRequest } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const componentId = searchParams.get('componentId')
  const status = searchParams.get('status')
  const role = searchParams.get('role')

  const where: Record<string, unknown> = {}
  if (componentId) where.componentId = componentId
  if (status) where.status = status
  if (role) where.role = role

  const rules = await prisma.payRule.findMany({
    where: where as any,
    include: { component: { select: { code: true, name: true } } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })
  return success(rules)
}, 'salaryStructure.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const { componentId, name, description, employeeCategory, role, departmentId, regionId, areaId, shopId, employmentType, ruleType, calculationMethod, baseAmount, percentageRate, maxAmount, minAmount, thresholdValue, thresholdMetric, tierConfigJson, formulaJson, requiresManualInput, requiresApproval, effectiveFrom, effectiveTo, status, priority } = body

  if (!componentId || !name || !effectiveFrom) return badRequest('Component ID, name, and effectiveFrom are required')

  const component = await prisma.payComponent.findUnique({ where: { id: componentId } })
  if (!component) return badRequest('Component not found')

  const rule = await prisma.payRule.create({
    data: {
      componentId, name,
      description: description || null,
      employeeCategory: employeeCategory || null,
      role: role || null,
      departmentId: departmentId || null,
      regionId: regionId || null,
      areaId: areaId || null,
      shopId: shopId || null,
      employmentType: employmentType || null,
      ruleType: ruleType || 'FIXED_AMOUNT',
      calculationMethod: calculationMethod || ruleType || 'FIXED_AMOUNT',
      baseAmount: baseAmount ?? null,
      percentageRate: percentageRate ?? null,
      maxAmount: maxAmount ?? null,
      minAmount: minAmount ?? null,
      thresholdValue: thresholdValue ?? null,
      thresholdMetric: thresholdMetric || null,
      tierConfigJson: tierConfigJson || null,
      formulaJson: formulaJson || null,
      requiresManualInput: requiresManualInput ?? false,
      requiresApproval: requiresApproval ?? false,
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      status: status || 'DRAFT',
      priority: priority ?? 0,
      createdById: ctx.userId,
    },
  })

  await createAuditLog({
    userId: ctx.userId,
    action: 'PAY_RULE_CREATE',
    entityType: 'PayRule',
    entityId: rule.id,
    newValue: { name, componentId, ruleType },
  })

  return success(rule, 201)
}, 'salaryStructure.manageRules')
