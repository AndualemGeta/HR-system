import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { resolveSalary } from '@/lib/payroll-calculation-engine'

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

    const employeeIssues: Record<string, string[]> = {}
    let readyCount = 0
    let blockedCount = 0
    let warningCount = 0

    for (const pe of selectedEmployees) {
      const emp = pe.employee
      const issues: string[] = []

      const salary = await resolveSalary(emp.id, period.periodEnd)
      if (!salary.basicSalary || salary.basicSalary <= 0) issues.push('MISSING_EFFECTIVE_BASIC_SALARY')

      if (!emp.employmentStatus || !['ACTIVE', 'ON_PROBATION', 'ON_LEAVE'].includes(emp.employmentStatus)) {
        if (emp.employmentStatus === 'SUSPENDED') issues.push('INVALID_EMPLOYEE_STATUS')
        else if (['RESIGNED', 'TERMINATED', 'EXITED'].includes(emp.employmentStatus || '')) issues.push('PARTIAL_PERIOD_EMPLOYEE')
        else issues.push('INVALID_EMPLOYEE_STATUS')
      }

      employeeIssues[emp.id] = issues
      if (issues.length === 0) readyCount++
      else if (issues.some(i => ['MISSING_EFFECTIVE_BASIC_SALARY', 'INVALID_EMPLOYEE_STATUS'].includes(i))) blockedCount++
      else warningCount++
    }

    const acceptedInputCount = await prisma.payrollInput.count({
      where: { payrollPeriodId: id, status: 'ACCEPTED' },
    })
    const unlockedAcceptedCount = await prisma.payrollInput.count({
      where: { payrollPeriodId: id, status: 'ACCEPTED', isLocked: false },
    })
    const missingRequiredInputCount = await prisma.payrollInputRequirement.count({
      where: {
        isActive: true,
        AND: [
          { inputType: { isActive: true } },
          { NOT: { inputType: { inputs: { some: { payrollPeriodId: id, status: 'ACCEPTED', isLocked: true } } } } },
        ],
      },
    })

    const readyForCalculation = period.status === 'READY_FOR_CALCULATION' && readyCount > 0 && blockedCount === 0

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
      missingRequiredInputCount,
      readyForCalculation,
      employeeIssues: Object.fromEntries(
        Object.entries(employeeIssues).map(([empId, issues]) => [
          empId,
          { employeeCode: selectedEmployees.find(pe => pe.employeeId === empId)?.employee.employeeId, issues },
        ])
      ),
    })
  } catch (e) { console.error(e); return internalError() }
}
