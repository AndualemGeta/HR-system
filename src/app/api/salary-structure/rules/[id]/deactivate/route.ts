import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { success, unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()

    // Emergency override: SUPER_ADMIN only
    const userRoles = await prisma.user.findUnique({ where: { id: session.userId }, include: { roles: { include: { role: true } } } })
    const isSuperAdmin = userRoles?.roles.some(r => r.role.name === 'SUPER_ADMIN')
    if (!isSuperAdmin) return forbidden('Only SUPER_ADMIN can directly deactivate rules. Use request-deactivation for approval workflow.')

    const body = await req.json().catch(() => ({}))
    if (!body.reason) return badRequest('Reason is required for emergency deactivation override')

    const rule = await prisma.payRule.findUnique({ where: { id } })
    if (!rule) return notFound('Rule not found')

    const updated = await prisma.payRule.update({
      where: { id },
      data: { status: 'INACTIVE', updatedById: session.userId },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAY_RULE_DEACTIVATE',
      entityType: 'PayRule',
      entityId: id,
      newValue: { status: 'INACTIVE', name: rule.name, reason: body.reason, override: true },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
