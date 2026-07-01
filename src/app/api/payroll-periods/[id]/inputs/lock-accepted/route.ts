import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.lock'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!period) return notFound('Payroll period not found')
    if (!['INPUT_COLLECTION_CLOSED', 'READY_FOR_REVIEW', 'REVIEW_IN_PROGRESS', 'READY_FOR_CALCULATION'].includes(period.status)) {
      return badRequest('Inputs can only be locked after input collection is closed.')
    }
    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    let scopeEmployeeIds: string[] | null = null
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmps = await prisma.employee.findMany({ where: scopeWhere, select: { id: true } })
      scopeEmployeeIds = scopeEmps.map(e => e.id)
    }
    const whereClause: any = { payrollPeriodId: id, status: 'ACCEPTED', isLocked: false }
    if (scopeEmployeeIds) whereClause.employeeId = { in: scopeEmployeeIds }
    const accepted = await prisma.payrollInput.findMany({ where: whereClause, select: { id: true } })
    if (accepted.length === 0) return success({ locked: 0, message: 'No accepted unlocked inputs found.' })
    await prisma.payrollInput.updateMany({
      where: whereClause,
      data: { isLocked: true, lockedById: session.userId, lockedAt: new Date() },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_LOCK_ACCEPTED', entityType: 'PayrollPeriod', entityId: id, newValue: { lockedCount: accepted.length } })
    return success({ locked: accepted.length })
  } catch (err) { console.error(err); return internalError() }
}
