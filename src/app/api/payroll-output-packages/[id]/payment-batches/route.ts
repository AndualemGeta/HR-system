import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { createPaymentBatch } from '@/lib/payroll/payment'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.create'))) return forbidden()
    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id } })
    if (!pkg) return notFound()
    const body = await req.json().catch(() => ({}))
    const { paymentMethod, includedEmployeeIds, exclusionReason } = body
    if (!paymentMethod) return badRequest('paymentMethod is required')
    const result = await createPaymentBatch(id, paymentMethod, session.userId, includedEmployeeIds, exclusionReason)
    if (!result.success) return badRequest(result.error || 'Batch creation failed')
    await createAuditLog({ userId: session.userId, action: 'PAYMENT_BATCH_CREATE' as never, entityType: 'PayrollPaymentBatch', entityId: result.batchId!, newValue: { paymentMethod } })
    return success({ batchId: result.batchId })
  } catch (e) { console.error(e); return internalError() }
}
