import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.view'))) return forbidden()
    const { id } = await params

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: { not: 'CANCELLED' } },
      orderBy: { version: 'desc' },
    })
    if (!batch) return notFound()

    const rows = await prisma.payrollPreparationRow.findMany({
      where: { batchId: batch.id },
      orderBy: [{ readinessStatus: 'asc' }, { fullName: 'asc' }],
    })

    return success({
      batch,
      rows,
      totalRows: rows.length,
      blockedRows: rows.filter(r => r.readinessStatus === 'BLOCKED').length,
      readyRows: rows.filter(r => r.readinessStatus === 'READY').length,
      warningRows: rows.filter(r => r.readinessStatus === 'WARNING').length,
    })
  } catch (e) { console.error(e); return internalError() }
}
