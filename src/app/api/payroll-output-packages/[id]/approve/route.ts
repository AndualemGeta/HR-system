import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { approveOutputPackage } from '@/lib/payroll/finalization'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollFinalization.approve'))) return forbidden()

    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id } })
    if (!pkg) return notFound()

    const result = await approveOutputPackage(id, session.userId)
    if (!result.success) return badRequest(result.error || 'Approval failed')

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_FINALIZATION_APPROVE' as never,
      entityType: 'PayrollOutputPackage', entityId: id,
      oldValue: { status: pkg.status }, newValue: { status: 'APPROVED' },
    })
    return success({ status: 'APPROVED' })
  } catch (e) { console.error(e); return internalError() }
}
