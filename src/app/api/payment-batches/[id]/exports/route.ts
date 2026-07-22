import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.view'))) return forbidden()
    const { id } = await params
    const exports = await prisma.payrollExportRecord.findMany({
      where: { paymentBatchId: id },
      orderBy: { generatedAt: 'desc' },
    })
    return success(exports)
  } catch (e) { console.error(e); return internalError() }
}
