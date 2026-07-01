import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { success, unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/api'
import { validateRuleForActivation } from '@/lib/salary-structure'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()

    // Emergency override: SUPER_ADMIN only
    const userRoles = await prisma.user.findUnique({ where: { id: session.userId }, include: { roles: { include: { role: true } } } })
    const isSuperAdmin = userRoles?.roles.some(r => r.role.name === 'SUPER_ADMIN')
    if (!isSuperAdmin) return forbidden('Only SUPER_ADMIN can directly activate rules. Use request-activation for approval workflow.')

    const body = await req.json().catch(() => ({}))
    if (!body.reason) return badRequest('Reason is required for emergency activation override')

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
      newValue: { status: 'ACTIVE', name: rule.name, reason: body.reason, override: true },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
