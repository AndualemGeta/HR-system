import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.reconcile'))) return forbidden()
    const { id } = await params
    const batch = await prisma.payrollPaymentBatch.findUnique({
      where: { id },
      include: { instructions: true },
    })
    if (!batch) return notFound()
    const totalGenerated = Number(batch.totalAmount) || 0
    const paid = batch.instructions.filter(i => i.status === 'PAID')
    const failed = batch.instructions.filter(i => i.status === 'FAILED')
    const held = batch.instructions.filter(i => i.status === 'HELD')
    const totalPaid = paid.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const totalOutstanding = totalGenerated - totalPaid
    await createAuditLog({ userId: session.userId, action: 'PAYMENT_BATCH_RECONCILE' as never, entityType: 'PayrollPaymentBatch', entityId: id })
    return success({ totalGenerated, totalPaid, totalFailed: failed.length, totalHeld: held.length, totalOutstanding })
  } catch (e) { console.error(e); return internalError() }
}
