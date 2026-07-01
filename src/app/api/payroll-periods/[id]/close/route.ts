import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.close'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'OPEN_FOR_INPUT') return badRequest('Only OPEN_FOR_INPUT periods can be closed')

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'INPUT_COLLECTION_CLOSED', updatedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PERIOD_CLOSE',
      entityType: 'PayrollPeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: updated.status },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
