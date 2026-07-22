import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; instructionId: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.reconcile'))) return forbidden()
    const { id, instructionId } = await params
    const instruction = await prisma.payrollPaymentInstruction.findUnique({ where: { id: instructionId, paymentBatchId: id } })
    if (!instruction) return notFound()
    const body = await req.json().catch(() => ({}))
    await prisma.payrollPaymentInstruction.update({
      where: { id: instructionId },
      data: { status: 'FAILED', failureReason: body.reason || 'Unknown' },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYMENT_INSTRUCTION_FAILED' as never, entityType: 'PayrollPaymentInstruction', entityId: instructionId, newValue: { status: 'FAILED', reason: body.reason } })
    return success({ status: 'FAILED' })
  } catch (e) { console.error(e); return internalError() }
}
