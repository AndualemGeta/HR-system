import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'statutoryReport.review'))) return forbidden()
    const { id } = await params
    const report = await prisma.payrollStatutoryReport.findUnique({ where: { id } })
    if (!report) return notFound()
    if (report.status !== 'DRAFT') return badRequest('STATUTORY_REPORT_ALREADY_APPROVED')
    await prisma.payrollStatutoryReport.update({ where: { id }, data: { status: 'REVIEWED', reviewedAt: new Date(), reviewedById: session.userId } })
    await createAuditLog({ userId: session.userId, action: 'STATUTORY_REPORT_REVIEW' as never, entityType: 'PayrollStatutoryReport', entityId: id, oldValue: { status: report.status }, newValue: { status: 'REVIEWED' } })
    return success({ status: 'REVIEWED' })
  } catch (e) { console.error(e); return internalError() }
}
