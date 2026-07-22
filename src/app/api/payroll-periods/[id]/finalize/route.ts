import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { finalizePayroll } from '@/lib/payroll/finalization'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollFinalization.create'))) return forbidden()

    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const result = await finalizePayroll(id, session.userId)
    if (!result.success) {
      return badRequest('Finalization failed', { blockers: result.blockers, warnings: result.warnings })
    }

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_FINALIZATION_CREATE' as never,
      entityType: 'PayrollOutputPackage',
      entityId: result.outputPackageId!,
      newValue: { payrollPeriodId: id, ...result.totals },
    })

    return success({ outputPackageId: result.outputPackageId, ...result.totals })
  } catch (e) { console.error(e); return internalError() }
}
