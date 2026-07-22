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
    if (!(await userHasPermission(session.userId, 'payrollJournal.approve'))) return forbidden()
    const { id } = await params
    const journal = await prisma.payrollJournalBatch.findUnique({ where: { id } })
    if (!journal) return notFound()
    if (journal.generatedById === session.userId) return badRequest('Generator cannot approve own journal')
    await prisma.payrollJournalBatch.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: session.userId } })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_JOURNAL_APPROVE' as never, entityType: 'PayrollJournalBatch', entityId: id, oldValue: { status: journal.status }, newValue: { status: 'APPROVED' } })
    return success({ status: 'APPROVED' })
  } catch (e) { console.error(e); return internalError() }
}
