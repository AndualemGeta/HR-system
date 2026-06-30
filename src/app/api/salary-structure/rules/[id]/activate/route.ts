import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/api'
import { validateRuleForActivation } from '@/lib/salary-structure'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.activateRule'))) return forbidden()

    const rule = await prisma.payRule.findUnique({ where: { id } })
    if (!rule) return notFound('Rule not found')

    const validation = await validateRuleForActivation(id)
    if (!validation.valid) return badRequest(validation.errors.join('; '))

    const updated = await prisma.payRule.update({
      where: { id },
      data: { status: 'ACTIVE', updatedById: session.userId },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAY_RULE_ACTIVATE',
      entityType: 'PayRule',
      entityId: id,
      newValue: { status: 'ACTIVE', name: rule.name },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
