import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { checkEmployeeReadiness } from '@/lib/payroll-calculation-engine'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.readiness'))) return forbidden()
    const { id } = await params

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const selectedEmployees = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true, removedAt: null },
      include: { employee: true },
    })

    let readyCount = 0
    let blockedCount = 0
    let warningCount = 0
    const employeeIssues: Record<string, { employeeCode: string; blockers: string[]; warnings: string[] }> = {}

    for (const pe of selectedEmployees) {
      const emp = pe.employee
      const readiness = await checkEmployeeReadiness(emp.id, emp, id, period.periodEnd, period.payDate)
      employeeIssues[emp.id] = {
        employeeCode: emp.employeeId,
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      }
      if (readiness.blockers.length > 0) blockedCount++
      else if (readiness.warnings.length > 0) warningCount++
      else readyCount++
    }

    // Global checks
    const acceptedInputCount = await prisma.payrollInput.count({
      where: { payrollPeriodId: id, status: 'ACCEPTED' },
    })
    const unlockedAcceptedCount = await prisma.payrollInput.count({
      where: { payrollPeriodId: id, status: 'ACCEPTED', isLocked: false },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_CALCULATION_READINESS_RUN',
      entityType: 'PayrollPeriod',
      entityId: id,
      newValue: { readyCount, blockedCount, warningCount, total: selectedEmployees.length },
    })

    return success({
      payrollPeriodId: id,
      periodStatus: period.status,
      selectedEmployees: selectedEmployees.length,
      readyEmployees: readyCount,
      blockedEmployees: blockedCount,
      warningEmployees: warningCount,
      acceptedInputCount,
      unlockedInputCount: unlockedAcceptedCount,
      readyForCalculation: period.status === 'READY_FOR_CALCULATION' && selectedEmployees.length > 0 && blockedCount === 0 && unlockedAcceptedCount === 0,
      employeeIssues,
    })
  } catch (e) { console.error(e); return internalError() }
}
