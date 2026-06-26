import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, notFound, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.deactivate'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const doc = await prisma.employeeDocument.findUnique({ where: { id: documentId } })
    if (!doc || doc.employeeId !== id) return notFound()
    if (!doc.isActive) return badRequest('Document is already deactivated')

    const body = await req.json().catch(() => ({}))
    const reason = body.reason || 'Deactivated by HR'

    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: session.userId,
        deactivationReason: reason,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_DEACTIVATE',
      entityType: 'EmployeeDocument',
      entityId: documentId,
      oldValue: { isActive: true },
      newValue: { isActive: false, reason },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
