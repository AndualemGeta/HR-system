import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.deactivateRule'))) return forbidden()

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
      newValue: { status: 'INACTIVE', name: rule.name },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
