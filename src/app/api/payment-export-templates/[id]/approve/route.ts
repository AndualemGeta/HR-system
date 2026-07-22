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
    if (!(await userHasPermission(session.userId, 'paymentExportTemplate.approve'))) return forbidden()
    const { id } = await params
    const template = await prisma.paymentExportTemplate.findUnique({ where: { id } })
    if (!template) return notFound()
    await prisma.paymentExportTemplate.update({ where: { id }, data: { approvedById: session.userId, approvedAt: new Date() } })
    await createAuditLog({ userId: session.userId, action: 'PAYMENT_EXPORT_TEMPLATE_APPROVE' as never, entityType: 'PaymentExportTemplate', entityId: id })
    return success({ approved: true })
  } catch (e) { console.error(e); return internalError() }
}
