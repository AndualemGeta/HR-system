import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.view'))) return forbidden()
    const { id, rowId } = await params

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const row = await prisma.payrollPreparationRow.findUnique({
      where: { id: rowId },
      include: { calculationLines: { orderBy: { calculationOrder: 'asc' } } },
    })
    if (!row) return notFound()

    return success(row)
  } catch (e) { console.error(e); return internalError() }
}
