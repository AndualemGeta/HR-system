import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success, badRequest, notFound } from '@/lib/api'
import { calculateRulePreview } from '@/lib/salary-structure'
import { createAuditLog } from '@/lib/audit'

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const { ruleId, inputValue } = body

  if (!ruleId) return badRequest('ruleId is required')
  if (inputValue === undefined || inputValue === null) return badRequest('inputValue is required')

  const rule = await prisma.payRule.findUnique({ where: { id: ruleId } })
  if (!rule) return notFound('Rule not found')

  const result = calculateRulePreview(rule, Number(inputValue))

  await createAuditLog({
    userId: ctx.userId,
    action: 'PAY_RULE_PREVIEW',
    entityType: 'PayRule',
    entityId: ruleId,
    newValue: { inputValue, result },
  })

  return success({ rule, ...result })
}, 'salaryStructure.preview')
