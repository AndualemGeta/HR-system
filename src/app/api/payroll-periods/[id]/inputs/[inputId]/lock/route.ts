import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { assertPayrollInputInUserScope } from '@/lib/payroll-scope'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.lock'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!period) return notFound('Payroll period not found')
    if (!['INPUT_COLLECTION_CLOSED', 'READY_FOR_REVIEW', 'REVIEW_IN_PROGRESS', 'READY_FOR_CALCULATION'].includes(period.status)) {
      return badRequest('Inputs can only be locked after input collection is closed.')
    }
    const input = await prisma.payrollInput.findUnique({ where: { id: inputId } })
    if (!input) return notFound('Input not found')
    if (input.status !== 'ACCEPTED') return badRequest('Only accepted inputs can be locked.')
    if (input.isLocked) return badRequest('Input is already locked.')
    const scope = await assertPayrollInputInUserScope(session.userId, inputId)
    if (!scope.allowed) return forbidden(scope.error)
    const updated = await prisma.payrollInput.update({
      where: { id: inputId },
      data: { isLocked: true, lockedById: session.userId, lockedAt: new Date(), lockReason: null },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_LOCK', entityType: 'PayrollInput', entityId: inputId, oldValue: { isLocked: false }, newValue: { isLocked: true } })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
