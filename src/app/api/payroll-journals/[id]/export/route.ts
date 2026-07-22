import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollJournal.export'))) return forbidden()
    const { id } = await params
    const journal = await prisma.payrollJournalBatch.findUnique({ where: { id }, include: { lines: true } })
    if (!journal) return notFound()
    const csv = 'Account Code,Account Name,Debit,Credit,Description\n'
      + journal.lines.map(l => `${l.accountCode},${l.accountName || ''},${(l.debitAmount || 0).toFixed(2)},${(l.creditAmount || 0).toFixed(2)},${l.description || ''}`).join('\n')
      + `\nTotal,,${(journal.totalDebit || 0).toFixed(2)},${(journal.totalCredit || 0).toFixed(2)},`
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="journal-${id.slice(0, 8)}.csv"` } })
  } catch (e) { console.error(e); return internalError() }
}
