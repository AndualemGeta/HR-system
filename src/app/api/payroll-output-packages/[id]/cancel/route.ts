import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { cancelOutputPackage } from '@/lib/payroll/finalization'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollFinalization.cancel'))) return forbidden()

    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id } })
    if (!pkg) return notFound()

    const body = await req.json().catch(() => ({}))
    const reason = body.reason || 'No reason provided'

    const result = await cancelOutputPackage(id, session.userId, reason)
    if (!result.success) return badRequest(result.error || 'Cancellation failed')

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_FINALIZATION_CANCEL' as never,
      entityType: 'PayrollOutputPackage', entityId: id,
      oldValue: { status: pkg.status }, newValue: { status: 'CANCELLED', reason },
    })
    return success({ status: 'CANCELLED' })
  } catch (e) { console.error(e); return internalError() }
}
