import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { generatePaymentExport } from '@/lib/payroll/payment'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.export'))) return forbidden()
    const { id } = await params
    const batch = await prisma.payrollPaymentBatch.findUnique({ where: { id } })
    if (!batch) return notFound()
    const body = await req.json().catch(() => ({}))
    const { templateId } = body
    if (!templateId) return badRequest('templateId is required')
    const result = await generatePaymentExport(id, templateId, session.userId)
    if (!result.success) return badRequest(result.error || 'Export failed')
    await createAuditLog({ userId: session.userId, action: 'PAYMENT_EXPORT_GENERATE' as never, entityType: 'PayrollExportRecord', entityId: result.exportId!, newValue: { batchId: id } })
    return success({ exportId: result.exportId })
  } catch (e) { console.error(e); return internalError() }
}
