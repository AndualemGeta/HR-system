import { prisma } from './prisma'
import { buildEmployeeScopeWhere } from './rbac'

export interface MissingInputResult {
  employeeId: string
  employeeName: string
  role: string
  department: string | null
  shop: string | null
  missingInputTypeCode: string
  missingInputTypeName: string
  severity: string
  suggestedAction: string
}

export async function checkPayrollPeriodMissingInputs(
  payrollPeriodId: string,
  userId?: string
): Promise<{ blockers: MissingInputResult[]; warnings: MissingInputResult[]; infos: MissingInputResult[] }> {
  const selectedEmps = await prisma.payrollPeriodEmployee.findMany({
    where: { payrollPeriodId, isSelected: true },
    select: { employeeId: true },
  })
  const empIds = selectedEmps.map(s => s.employeeId)

  let scopeEmployeeIds: Set<string> | null = null
  if (userId) {
    const scopeWhere = await buildEmployeeScopeWhere(userId)
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmps = await prisma.employee.findMany({ where: scopeWhere, select: { id: true } })
      scopeEmployeeIds = new Set(scopeEmps.map(e => e.id))
    }
  }

  const activeRequirements = await prisma.payrollInputRequirement.findMany({
    where: { isActive: true },
    include: { inputType: { select: { id: true, code: true, name: true } } },
  })

  const existingInputs = await prisma.payrollInput.findMany({
    where: { payrollPeriodId },
    select: { employeeId: true, inputTypeId: true },
  })
  const existingSet = new Set(existingInputs.map(i => `${i.employeeId}:${i.inputTypeId}`))

  const waivers = await prisma.payrollInputWaiver.findMany({
    where: { payrollPeriodId, isActive: true },
    select: { employeeId: true, inputTypeId: true },
  })
  const waivedSet = new Set(waivers.map(w => `${w.employeeId}:${w.inputTypeId}`))

  const employees = await prisma.employee.findMany({
    where: { id: { in: empIds } },
    select: {
      id: true, employeeId: true, fullName: true, currentRole: true,
      currentDepartmentId: true, currentShopId: true, employeeCategory: true,
      currentAreaId: true, currentRegionId: true, employmentType: true,
    },
  })
  const empMap = new Map(employees.map(e => [e.id, e]))

  const deptIds = [...new Set(employees.filter(e => e.currentDepartmentId).map(e => e.currentDepartmentId!))]
  const departments = deptIds.length > 0 ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : []
  const deptMap = new Map(departments.map(d => [d.id, d.name]))

  const blockers: MissingInputResult[] = []
  const warnings: MissingInputResult[] = []
  const infos: MissingInputResult[] = []

  for (const sel of selectedEmps) {
    if (scopeEmployeeIds && !scopeEmployeeIds.has(sel.employeeId)) continue
    const emp = empMap.get(sel.employeeId)
    if (!emp) continue
    for (const req of activeRequirements) {
      if (req.role && req.role !== emp.currentRole) continue
      if (req.employeeCategory && req.employeeCategory !== emp.employeeCategory) continue
      if (req.departmentId && req.departmentId !== emp.currentDepartmentId) continue
      if (req.regionId && req.regionId !== emp.currentRegionId) continue
      if (req.areaId && req.areaId !== emp.currentAreaId) continue
      if (req.shopId && req.shopId !== emp.currentShopId) continue
      if (req.employmentType && req.employmentType !== emp.employmentType) continue
      const key = `${emp.id}:${req.inputTypeId}`
      if (existingSet.has(key)) continue
      if (waivedSet.has(key)) continue
      const result: MissingInputResult = {
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        role: emp.currentRole,
        department: deptMap.get(emp.currentDepartmentId || '') || null,
        shop: emp.currentShopId || null,
        missingInputTypeCode: req.inputType.code,
        missingInputTypeName: req.inputType.name,
        severity: req.severity,
        suggestedAction: `Add ${req.inputType.name} input for this employee`,
      }
      if (req.severity === 'BLOCKER') blockers.push(result)
      else if (req.severity === 'WARNING') warnings.push(result)
      else infos.push(result)
    }
  }
  return { blockers, warnings, infos }
}
