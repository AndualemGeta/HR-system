import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; instructionId: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.reconcile'))) return forbidden()
    const { id, instructionId } = await params
    const instruction = await prisma.payrollPaymentInstruction.findUnique({ where: { id: instructionId, paymentBatchId: id } })
    if (!instruction) return notFound()
    if (instruction.status === 'PAID') return badRequest('PAYMENT_ALREADY_COMPLETED')
    const body = await req.json().catch(() => ({}))
    const extRef = body.externalReference
    if (extRef) {
      const dup = await prisma.payrollPaymentInstruction.findFirst({ where: { externalReference: extRef, id: { not: instructionId } } })
      if (dup) return badRequest('DUPLICATE_EXTERNAL_PAYMENT_REFERENCE')
    }
    await prisma.payrollPaymentInstruction.update({
      where: { id: instructionId },
      data: { status: 'PAID', externalReference: extRef, paidAt: new Date() },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYMENT_INSTRUCTION_PAID' as never, entityType: 'PayrollPaymentInstruction', entityId: instructionId, newValue: { status: 'PAID', externalReference: extRef } })
    return success({ status: 'PAID' })
  } catch (e) { console.error(e); return internalError() }
}
