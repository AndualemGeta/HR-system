import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { checkPayrollPeriodMissingInputs } from '@/lib/payroll-missing-inputs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPreparationSummary.view'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id }, include: { createdBy: { select: { name: true } } } })
    if (!period) return notFound('Payroll period not found')
    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    let scopeFilter: any = {}
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmps = await prisma.employee.findMany({ where: scopeWhere, select: { id: true } })
      scopeFilter = { employeeId: { in: scopeEmps.map(e => e.id) } }
    }
    const selectedEmployees = await prisma.payrollPeriodEmployee.count({ where: { payrollPeriodId: id, isSelected: true, ...(scopeFilter.employeeId ? { employeeId: scopeFilter.employeeId } : {}) } })
    const inputBaseWhere: any = { payrollPeriodId: id }
    if (scopeFilter.employeeId) inputBaseWhere.employeeId = scopeFilter.employeeId
    const totalInputs = await prisma.payrollInput.count({ where: inputBaseWhere })
    const inputByStatus = await Promise.all(
      ['DRAFT', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'REJECTED'].map(async status => {
        const count = await prisma.payrollInput.count({ where: { ...inputBaseWhere, status } })
        return { status, count }
      })
    )
    const lockedCount = await prisma.payrollInput.count({ where: { ...inputBaseWhere, isLocked: true } })
    const unlockedCount = await prisma.payrollInput.count({ where: { ...inputBaseWhere, isLocked: false } })
    const readyEmployees = await prisma.employee.count({
      where: { payrollPeriodEmployees: { some: { payrollPeriodId: id, isSelected: true } }, payrollProfile: { isNot: null } },
    })
    const notReadyEmployees = selectedEmployees - readyEmployees
    const missingInputs = await checkPayrollPeriodMissingInputs(id, session.userId)
    const waivers = await prisma.payrollInputWaiver.findMany({ where: { payrollPeriodId: id, isActive: true } })
    const waivedSummary = {
      total: waivers.length,
      bySeverity: { BLOCKER: waivers.filter(w => w.severity === 'BLOCKER').length, WARNING: waivers.filter(w => w.severity === 'WARNING').length, INFO: waivers.filter(w => w.severity === 'INFO').length },
    }
    const rejectedInputs = await prisma.payrollInput.count({ where: { ...inputBaseWhere, status: 'REJECTED' } })
    const returnedInputs = await prisma.payrollInput.count({ where: { ...inputBaseWhere, status: 'RETURNED' } })
    const unlockedAccepted = await prisma.payrollInput.count({ where: { ...inputBaseWhere, status: 'ACCEPTED', isLocked: false } })
    const readyForCalc = period.status === 'READY_FOR_CALCULATION'
    return success({
      periodDetails: period,
      selectedEmployeeCount: selectedEmployees,
      readyEmployeeCount: readyEmployees,
      notReadyEmployeeCount: Math.max(0, notReadyEmployees),
      inputStatusSummary: { total: totalInputs, byStatus: Object.fromEntries(inputByStatus.map(s => [s.status, s.count])) },
      missingInputSummary: { blockers: missingInputs.blockers.length, warnings: missingInputs.warnings.length, infos: missingInputs.infos.length },
      waivedInputSummary: waivedSummary,
      lockedInputSummary: { locked: lockedCount, unlocked: unlockedCount },
      reviewStatus: period.status,
      readyForCalculationChecklist: { isReady: readyForCalc, missingRequiredInputs: missingInputs.blockers.length + missingInputs.warnings.length, rejectedInputs, returnedInputs, unlockedAcceptedInputs: unlockedAccepted },
    })
  } catch (err) { console.error(err); return internalError() }
}
