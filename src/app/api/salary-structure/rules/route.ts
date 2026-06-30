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

  if (status === 'ACTIVE') return badRequest('Cannot create rule with ACTIVE status; use the activate endpoint')

  const method = calculationMethod || ruleType
  if (method === 'FIXED_AMOUNT' && !baseAmount) return badRequest('baseAmount is required for FIXED_AMOUNT method')
  if (method === 'PERCENTAGE' && (!percentageRate || Number(percentageRate) <= 0)) return badRequest('percentageRate (>0) is required for PERCENTAGE method')
  if (method === 'THRESHOLD' && thresholdValue === undefined) return badRequest('thresholdValue is required for THRESHOLD method')
  if (method === 'TIERED' && !tierConfigJson) return badRequest('tierConfigJson is required for TIERED method')
  if (thresholdValue !== undefined && Number(thresholdValue) < 0) return badRequest('thresholdValue cannot be negative')
  if (percentageRate !== undefined && (Number(percentageRate) < 0 || Number(percentageRate) > 100)) return badRequest('percentageRate must be between 0 and 100')
  if (baseAmount !== undefined && Number(baseAmount) < 0) return badRequest('baseAmount cannot be negative')
  if (maxAmount !== undefined && Number(maxAmount) < 0) return badRequest('maxAmount cannot be negative')
  if (minAmount !== undefined && Number(minAmount) < 0) return badRequest('minAmount cannot be negative')

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
