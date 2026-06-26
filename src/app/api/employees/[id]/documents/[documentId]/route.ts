import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { canViewDocument } from '@/lib/documents'
import { success, notFound, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const doc = await prisma.employeeDocument.findUnique({ where: { id: documentId } })
    if (!doc || doc.employeeId !== id) return notFound()
    if (!(await canViewDocument(session.userId, documentId))) return forbidden()

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_VIEW',
      entityType: 'EmployeeDocument',
      entityId: documentId,
    })

    return success(doc)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.upload'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const doc = await prisma.employeeDocument.findUnique({ where: { id: documentId } })
    if (!doc || doc.employeeId !== id) return notFound()

    const body = await req.json().catch(() => ({}))
    const updateData: Record<string, unknown> = {}

    if (body.visibilityLevel) {
      const valid = ['PUBLIC_TO_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE', 'SENSITIVE_HR_ONLY', 'SALARY_RESTRICTED']
      if (!valid.includes(body.visibilityLevel)) return badRequest('Invalid visibility level')
      updateData.visibilityLevel = body.visibilityLevel
    }
    if (body.notes !== undefined) updateData.notes = body.notes

    const updated = await prisma.employeeDocument.update({ where: { id: documentId }, data: updateData })

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_UPDATE',
      entityType: 'EmployeeDocument',
      entityId: documentId,
      oldValue: { visibilityLevel: doc.visibilityLevel, notes: doc.notes },
      newValue: updateData,
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
