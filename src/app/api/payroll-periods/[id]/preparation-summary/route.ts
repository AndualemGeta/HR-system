import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { checkPayrollPeriodMissingInputs } from '@/lib/payroll-missing-inputs'
import { getPayrollReadiness } from '@/lib/payroll-readiness'

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
    const selectedPPEs = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true, ...(scopeFilter.employeeId ? { employeeId: scopeFilter.employeeId } : {}) },
      select: { employeeId: true },
    })
    const selectedEmployeeIds = selectedPPEs.map(s => s.employeeId)
    const selectedEmployeeCount = selectedEmployeeIds.length
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
    let readyEmployeeCount = 0
    let notReadyEmployeeCount = 0
    for (const eid of selectedEmployeeIds) {
      const readiness = await getPayrollReadiness(eid)
      if (readiness) {
        if (readiness.blockers.length > 0) notReadyEmployeeCount++
        else readyEmployeeCount++
      }
    }
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
      selectedEmployeeCount,
      readyEmployeeCount,
      notReadyEmployeeCount,
      inputStatusSummary: { total: totalInputs, byStatus: Object.fromEntries(inputByStatus.map(s => [s.status, s.count])) },
      missingInputSummary: { blockers: missingInputs.blockers.length, warnings: missingInputs.warnings.length, infos: missingInputs.infos.length },
      waivedInputSummary: waivedSummary,
      lockedInputSummary: { locked: lockedCount, unlocked: unlockedCount },
      reviewStatus: period.status,
      readyForCalculationChecklist: { isReady: readyForCalc, missingRequiredInputs: missingInputs.blockers.length, rejectedInputs, returnedInputs, unlockedAcceptedInputs: unlockedAccepted },
    })
  } catch (err) { console.error(err); return internalError() }
}
