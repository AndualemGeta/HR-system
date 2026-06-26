import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, notFound, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.manageRules'))) return forbidden()

    const existing = await prisma.requiredDocumentRule.findUnique({ where: { id } })
    if (!existing) return notFound()
    if (!existing.isActive) return badRequest('Rule is already deactivated')

    const updated = await prisma.requiredDocumentRule.update({
      where: { id },
      data: { isActive: false },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_RULE_DEACTIVATE',
      entityType: 'RequiredDocumentRule',
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
