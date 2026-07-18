import { prisma } from '@/lib/prisma'
import { resolveSalary } from './salary'
import { selectPensionRule, getApprovedPensionRules } from './pension'
import { getApprovedPayeBrackets } from './tax'
import { validatePayComponent, getEffectiveKpiDefaultAmount } from './components'
import type { ReadinessCheckResult } from './types'

export async function checkEmployeeReadiness(
  employeeId: string,
  employee: { employmentStatus?: string | null; employmentType?: string | null; currentRole?: string | null; employeeCategory?: string | null; currentDepartmentId?: string | null; currentRegionId?: string | null; currentAreaId?: string | null; currentShopId?: string | null },
  payrollPeriodId: string,
  periodEnd: Date,
  payDate: Date,
): Promise<ReadinessCheckResult> {
  const blockers: string[] = []
  const warnings: string[] = []

  const salary = await resolveSalary(employeeId, periodEnd)
  if (!salary.basicSalary || salary.basicSalary <= 0) {
    blockers.push('MISSING_EFFECTIVE_BASIC_SALARY')
  }

  if (!employee.employmentStatus || !['ACTIVE', 'ON_PROBATION', 'ON_LEAVE'].includes(employee.employmentStatus)) {
    if (employee.employmentStatus === 'SUSPENDED') blockers.push('INVALID_EMPLOYEE_STATUS')
    else if (['RESIGNED', 'TERMINATED', 'EXITED'].includes(employee.employmentStatus || '')) blockers.push('PARTIAL_PERIOD_EMPLOYEE')
    else blockers.push('INVALID_EMPLOYEE_STATUS')
  }

  const requirements = await prisma.payrollInputRequirement.findMany({
    where: {
      isActive: true,
      OR: [
        { employeeCategory: (employee.employeeCategory as any) ?? undefined },
        { role: (employee.currentRole as any) ?? undefined },
        { departmentId: (employee.currentDepartmentId as any) ?? undefined },
        { regionId: (employee.currentRegionId as any) ?? undefined },
        { areaId: (employee.currentAreaId as any) ?? undefined },
        { shopId: (employee.currentShopId as any) ?? undefined },
        { employmentType: (employee.employmentType as any) ?? undefined },
      ].filter(c => Object.values(c)[0] !== undefined && Object.values(c)[0] !== null),
    },
    include: { inputType: { include: { payComponent: true } } },
  })

  for (const req of requirements) {
    const matchCategory = !req.employeeCategory || (req.employeeCategory as string) === (employee.employeeCategory ?? null)
    const matchRole = !req.role || (req.role as string) === (employee.currentRole ?? null)
    const matchDept = !req.departmentId || req.departmentId === (employee.currentDepartmentId ?? null)
    const matchRegion = !req.regionId || req.regionId === (employee.currentRegionId ?? null)
    const matchArea = !req.areaId || req.areaId === (employee.currentAreaId ?? null)
    const matchShop = !req.shopId || req.shopId === (employee.currentShopId ?? null)
    const matchEmpType = !req.employmentType || (req.employmentType as string) === (employee.employmentType ?? null)

    if (!matchCategory || !matchRole || !matchDept || !matchRegion || !matchArea || !matchShop || !matchEmpType) continue

    const hasInput = await prisma.payrollInput.findFirst({
      where: { payrollPeriodId, employeeId, inputTypeId: req.inputTypeId, status: 'ACCEPTED' },
    })
    const hasWaiver = await prisma.payrollInputWaiver.findFirst({
      where: { payrollPeriodId, employeeId, inputTypeId: req.inputTypeId, isActive: true },
    })

    if (req.severity === 'BLOCKER' && !hasInput && !hasWaiver) {
      blockers.push(`MISSING_REQUIRED_INPUT:${req.inputType.code}`)
    } else if (req.severity === 'WARNING' && !hasInput && !hasWaiver) {
      warnings.push(`MISSING_REQUIRED_INPUT:${req.inputType.code}`)
    }

    if (hasInput && !hasInput.isLocked) {
      blockers.push(`INPUT_NOT_LOCKED:${req.inputType.code}`)
    }

    if (req.inputType && !req.inputType.isActive) {
      blockers.push(`INPUT_TYPE_INACTIVE:${req.inputType.code}`)
    }
    if (req.inputType && !req.inputType.payComponentId) {
      blockers.push(`UNMAPPED_PAYROLL_INPUT_TYPE:${req.inputType.code}`)
    }
    if (req.inputType?.payComponent) {
      const comp = req.inputType.payComponent
      const compBlockers = validatePayComponent({
        id: comp.id,
        code: comp.code,
        name: comp.name,
        componentType: comp.componentType,
        isEarning: comp.isEarning,
        isDeduction: comp.isDeduction,
        isPensionable: comp.isPensionable,
        taxablePercent: Number(comp.taxablePercent),
        pensionablePercent: Number(comp.pensionablePercent),
        affectsGross: comp.affectsGross,
        affectsNet: comp.affectsNet,
        affectsEmployerCost: comp.affectsEmployerCost,
        calculationOrder: comp.calculationOrder,
        taxTreatment: comp.taxTreatment,
        isActive: comp.isActive,
        deductionTiming: comp.deductionTiming,
      })
      blockers.push(...compBlockers.map(b => `${b}:${comp.code}`))
    }
  }

  const kpiReq = requirements.find(r => r.inputType?.code === 'KPI_ACHIEVEMENT_PERCENT')
  if (kpiReq?.inputType?.payComponent) {
    const kpiComp = kpiReq.inputType.payComponent
    if (!kpiComp.isActive) {
      blockers.push(`KPI_COMPONENT_INACTIVE:${kpiComp.code}`)
    }
    if (kpiComp.taxTreatment === 'UNKNOWN') {
      blockers.push(`UNKNOWN_KPI_TAX_TREATMENT:${kpiComp.code}`)
    }
    const kpiAssignment = await getEffectiveKpiDefaultAmount(employeeId, kpiComp.id, periodEnd)
    if (!kpiAssignment) {
      blockers.push('MISSING_EFFECTIVE_KPI_DEFAULT_AMOUNT')
    }
    if (kpiAssignment && kpiAssignment.defaultAmount < 0) {
      blockers.push('MISSING_EFFECTIVE_KPI_DEFAULT_AMOUNT')
    }
  }

  const payeBrackets = await getApprovedPayeBrackets(payDate)
  if (payeBrackets.length === 0) blockers.push('MISSING_PAYE_SCHEDULE')

  const pensionRules = await getApprovedPensionRules(payDate)
  const { blockers: prBlockers } = selectPensionRule(pensionRules, {
    employmentType: employee.employmentType,
    role: employee.currentRole,
  })
  blockers.push(...prBlockers)

  return { employeeId, blockers, warnings }
}
