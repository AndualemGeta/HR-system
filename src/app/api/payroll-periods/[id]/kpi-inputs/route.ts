import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.view'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    const selectedPPEs = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true, removedAt: null },
      select: { employeeId: true },
    })
    const selectedIds = selectedPPEs.map(s => s.employeeId)

    const employees = await prisma.employee.findMany({
      where: { id: { in: selectedIds }, ...scopeWhere },
      select: {
        id: true, employeeId: true, fullName: true, currentRole: true,
        currentDepartmentId: true, currentRegionId: true, currentAreaId: true, currentShopId: true,
      },
    })

    const empIdSet = employees.map(e => e.id)

    const kpiComponent = await prisma.payComponent.findUnique({ where: { code: 'KPI_ALLOWANCE' } })
    const kpiInputType = await prisma.payrollInputType.findUnique({ where: { code: 'KPI_ACHIEVEMENT_PERCENT' } })

    let assignments: any[] = []
    let existingInputs: any[] = []

    if (kpiComponent) {
      assignments = await prisma.employeePayComponentAssignment.findMany({
        where: {
          employeeId: { in: empIdSet },
          payComponentId: kpiComponent.id,
          isActive: true,
          effectiveFrom: { lte: period.periodEnd },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }] },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      })
    }

    if (kpiInputType) {
      existingInputs = await prisma.payrollInput.findMany({
        where: {
          payrollPeriodId: id,
          employeeId: { in: empIdSet },
          inputTypeId: kpiInputType.id,
        },
        select: {
          id: true, employeeId: true, value: true, status: true, isLocked: true, note: true,
        },
      })
    }

    const inputMap = new Map(existingInputs.map(i => [i.employeeId, i]))
    const assignmentMap = new Map<string, typeof assignments[0]>()
    for (const a of assignments) {
      if (!assignmentMap.has(a.employeeId) || a.effectiveFrom > assignmentMap.get(a.employeeId)!.effectiveFrom) {
        assignmentMap.set(a.employeeId, a)
      }
    }

    const result = employees.map(emp => {
      const assignment = assignmentMap.get(emp.id) || null
      const input = inputMap.get(emp.id) || null
      const defaultAmount = assignment ? Number(assignment.defaultAmount) : 0
      const percentage = input?.value !== null && input?.value !== undefined ? Number(input.value) : (assignment ? 100 : null)
      const calculatedAmount = defaultAmount && percentage !== null ? Math.round(defaultAmount * percentage / 100) : 0

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        fullName: emp.fullName,
        role: emp.currentRole,
        hasAssignment: !!assignment,
        defaultAmount,
        percentage,
        calculatedAmount,
        inputId: input?.id || null,
        inputStatus: input?.status || null,
        isLocked: input?.isLocked || false,
        note: input?.note || null,
      }
    })

    return success({ rows: result, periodEnd: period.periodEnd, kpiInputType: kpiInputType || null })
  } catch (err) { console.error(err); return internalError() }
}
