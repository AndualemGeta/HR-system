import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; waiverId: string }> }) {
  try {
    const { waiverId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputWaiver.deactivate'))) return forbidden()
    const waiver = await prisma.payrollInputWaiver.findUnique({ where: { id: waiverId } })
    if (!waiver) return notFound('Waiver not found')
    const updated = await prisma.payrollInputWaiver.update({ where: { id: waiverId }, data: { isActive: false } })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_WAIVER_DEACTIVATE', entityType: 'PayrollInputWaiver', entityId: waiverId, oldValue: { isActive: true }, newValue: { isActive: false } })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
