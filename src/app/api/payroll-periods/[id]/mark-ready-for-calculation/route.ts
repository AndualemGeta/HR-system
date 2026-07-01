import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { checkPayrollPeriodMissingInputs } from '@/lib/payroll-missing-inputs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.markReadyForCalculation'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'REVIEW_IN_PROGRESS' && period.status !== 'READY_FOR_REVIEW') {
      return badRequest('Period must be in review to mark ready for calculation.')
    }
    const missingInputs = await checkPayrollPeriodMissingInputs(id, session.userId)
    const rejectedCount = await prisma.payrollInput.count({ where: { payrollPeriodId: id, status: 'REJECTED' } })
    const returnedCount = await prisma.payrollInput.count({ where: { payrollPeriodId: id, status: 'RETURNED' } })
    const unlockedAccepted = await prisma.payrollInput.count({ where: { payrollPeriodId: id, status: 'ACCEPTED', isLocked: false } })
    const blockedEmployees = await prisma.employee.count({
      where: {
        payrollPeriodEmployees: { some: { payrollPeriodId: id, isSelected: true } },
        payrollProfile: { is: { id: { not: undefined } } },
      },
    })
    const checklist = {
      missingRequiredInputs: missingInputs.blockers.length + missingInputs.warnings.length,
      rejectedInputs: rejectedCount,
      returnedInputs: returnedCount,
      unlockedAcceptedInputs: unlockedAccepted,
      employeesWithPayrollReadinessBlockers: blockedEmployees,
    }
    if (checklist.missingRequiredInputs > 0 || checklist.rejectedInputs > 0 || checklist.returnedInputs > 0 || checklist.unlockedAcceptedInputs > 0) {
      return badRequest('Period is not ready for calculation', checklist)
    }
    const updated = await prisma.payrollPeriod.update({ where: { id }, data: { status: 'READY_FOR_CALCULATION' } })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_PERIOD_READY_FOR_CALCULATION', entityType: 'PayrollPeriod', entityId: id, oldValue: { status: period.status }, newValue: { status: 'READY_FOR_CALCULATION' } })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
