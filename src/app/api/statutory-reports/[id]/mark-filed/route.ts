import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'statutoryReport.markFiled'))) return forbidden()
    const { id } = await params
    const report = await prisma.payrollStatutoryReport.findUnique({ where: { id } })
    if (!report) return notFound()
    const body = await req.json().catch(() => ({}))
    if (!body.filingReference) return badRequest('INVALID_FILING_REFERENCE')
    await prisma.payrollStatutoryReport.update({
      where: { id },
      data: { status: 'FILED', filedAt: new Date(), filedById: session.userId, filingReference: body.filingReference, filingDate: body.filingDate ? new Date(body.filingDate) : new Date() },
    })
    await createAuditLog({ userId: session.userId, action: 'STATUTORY_REPORT_FILED' as never, entityType: 'PayrollStatutoryReport', entityId: id, newValue: { status: 'FILED', filingReference: body.filingReference } })
    return success({ status: 'FILED' })
  } catch (e) { console.error(e); return internalError() }
}
