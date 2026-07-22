import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.export'))) return forbidden()
    const { id } = await params
    const record = await prisma.payrollExportRecord.findUnique({ where: { id } })
    if (!record) return notFound()
    await prisma.payrollExportRecord.update({
      where: { id },
      data: { downloadedCount: { increment: 1 }, lastDownloadedAt: new Date() },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_EXPORT_DOWNLOAD' as never, entityType: 'PayrollExportRecord', entityId: id })
    return new Response(`Export: ${record.fileName}\nRows: ${record.rowCount}\nTotal: ${Number(record.totalAmount).toFixed(2)}\nChecksum: ${record.checksum}`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${record.fileName}"` },
    })
  } catch (e) { console.error(e); return internalError() }
}
