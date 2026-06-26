import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { canDownloadDocument } from '@/lib/documents'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.download'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const doc = await prisma.employeeDocument.findUnique({ where: { id: documentId } })
    if (!doc || doc.employeeId !== id) return notFound()
    if (!(await canDownloadDocument(session.userId, documentId))) return forbidden()

    const filePath = join(process.cwd(), doc.filePath)
    const buffer = await readFile(filePath).catch(() => null)
    if (!buffer) return notFound('File not found on disk')

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_DOWNLOAD',
      entityType: 'EmployeeDocument',
      entityId: documentId,
      newValue: { originalFilename: doc.originalFilename, documentType: doc.documentType },
    })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.originalFilename || 'download'}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
