import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { evaluatePayrollPeriodReadiness } from '@/lib/payroll-calculation-engine'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.readiness'))) return forbidden()
    const { id } = await params

    const readiness = await evaluatePayrollPeriodReadiness({ payrollPeriodId: id, userId: session.userId, includeEmployeeDetails: true })

    const employeeIssues: Record<string, { employeeCode: string; blockers: string[]; warnings: string[] }> = {}
    for (const emp of readiness.employeeResults) {
      employeeIssues[emp.employeeId] = {
        employeeCode: emp.employeeCode,
        blockers: emp.blockers,
        warnings: emp.warnings,
      }
    }

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_CALCULATION_READINESS_RUN',
      entityType: 'PayrollPeriod',
      entityId: id,
      newValue: {
        readyCount: readiness.readyEmployeeCount,
        blockedCount: readiness.blockedEmployeeCount,
        warningCount: readiness.warningEmployeeCount,
        total: readiness.selectedEmployeeCount,
      },
    })

    return success({
      payrollPeriodId: id,
      readyForCalculation: readiness.readyForCalculation,
      selectedEmployees: readiness.selectedEmployeeCount,
      readyEmployees: readiness.readyEmployeeCount,
      blockedEmployees: readiness.blockedEmployeeCount,
      warningEmployees: readiness.warningEmployeeCount,
      periodBlockers: readiness.periodBlockers,
      periodWarnings: readiness.periodWarnings,
      employeeIssues,
    })
  } catch (e) { console.error(e); return internalError() }
}
