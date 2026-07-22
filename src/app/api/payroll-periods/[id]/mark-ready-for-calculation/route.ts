import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { evaluatePayrollPeriodReadiness } from '@/lib/payroll-calculation-engine'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.markReadyForCalculation'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'INPUT_COLLECTION_CLOSED' && period.status !== 'REVIEW_IN_PROGRESS' && period.status !== 'READY_FOR_REVIEW') {
      return badRequest(`Period status is ${period.status}, expected INPUT_COLLECTION_CLOSED, REVIEW_IN_PROGRESS or READY_FOR_REVIEW`)
    }
    const readiness = await evaluatePayrollPeriodReadiness({ payrollPeriodId: id, userId: session.userId, includeEmployeeDetails: true })
    if (!readiness.readyForCalculation) {
      return badRequest('Period is not ready for calculation', {
        periodBlockers: readiness.periodBlockers,
        periodWarnings: readiness.periodWarnings,
        selectedEmployeeCount: readiness.selectedEmployeeCount,
        readyEmployeeCount: readiness.readyEmployeeCount,
        warningEmployeeCount: readiness.warningEmployeeCount,
        blockedEmployeeCount: readiness.blockedEmployeeCount,
        employeeResults: readiness.employeeResults,
      })
    }
    const updated = await prisma.payrollPeriod.update({ where: { id }, data: { status: 'READY_FOR_CALCULATION' } })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_PERIOD_READY_FOR_CALCULATION', entityType: 'PayrollPeriod', entityId: id, oldValue: { status: period.status }, newValue: { status: 'READY_FOR_CALCULATION' } })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
