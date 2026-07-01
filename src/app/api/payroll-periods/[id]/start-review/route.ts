import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.review'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (!['INPUT_COLLECTION_CLOSED', 'READY_FOR_REVIEW'].includes(period.status)) {
      return badRequest('Review can only start when input collection is closed.')
    }
    const updated = await prisma.payrollPeriod.update({ where: { id }, data: { status: 'REVIEW_IN_PROGRESS' } })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_PERIOD_REVIEW_START', entityType: 'PayrollPeriod', entityId: id, oldValue: { status: period.status }, newValue: { status: 'REVIEW_IN_PROGRESS' } })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
