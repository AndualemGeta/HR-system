import { prisma } from '@/lib/prisma'
import { resolveSalary } from './salary'
import { selectPensionRule, getApprovedPensionRules } from './pension'
import { getApprovedPayeBrackets } from './tax'
import { validatePayComponent, getEffectiveKpiDefaultAmount } from './components'

// ── Dashboard Readiness ─────────────────────────────────────────────────

export interface PayrollReadinessResult {
  employeeId: string
  employeeRecordId: string
  fullName: string
  role: string | null
  department: string | null
  shop: string | null
  region: string | null
  area: string | null
  employmentStatus: string | null
  employeeCategory: string | null
  basicSalaryStatus: 'COMPLETE' | 'MISSING' | 'INVALID'
  paymentInfoStatus: 'COMPLETE' | 'MISSING'
  taxInfoStatus: 'COMPLETE' | 'MISSING'
  pensionInfoStatus: 'COMPLETE' | 'MISSING'
  assignmentStatus: 'COMPLETE' | 'MISSING'
  managerStatus: 'COMPLETE' | 'MISSING' | 'NOT_REQUIRED'
  overallStatus: 'READY' | 'WARNING' | 'NOT_READY' | 'INACTIVE'
  readinessPercentage: number
  blockers: string[]
  warnings: string[]
}

export async function getPayrollReadiness(employeeId: string): Promise<PayrollReadinessResult | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { payrollProfile: true },
  })
  if (!employee) return null

  const [department, shop, region, area] = await Promise.all([
    employee.currentDepartmentId ? prisma.department.findUnique({ where: { id: employee.currentDepartmentId }, select: { name: true } }) : null,
    employee.currentShopId ? prisma.location.findUnique({ where: { id: employee.currentShopId }, select: { name: true } }) : null,
    employee.currentRegionId ? prisma.location.findUnique({ where: { id: employee.currentRegionId }, select: { name: true } }) : null,
    employee.currentAreaId ? prisma.location.findUnique({ where: { id: employee.currentAreaId }, select: { name: true } }) : null,
  ])

  const blockers: string[] = []
  const warnings: string[] = []

  const basicSalaryStatus = employee.basicSalary ? 'COMPLETE' : 'MISSING'
  if (basicSalaryStatus === 'MISSING') blockers.push('Basic salary is missing')

  const hasPaymentInfo = employee.payrollProfile && (employee.payrollProfile.bankAccountNumber || employee.payrollProfile.mpesaAccount)
  const paymentInfoStatus = hasPaymentInfo ? 'COMPLETE' : 'MISSING'
  if (paymentInfoStatus === 'MISSING') blockers.push('Payment account (bank or M-PESA) is missing')

  const hasPaymentMethod = employee.payrollProfile?.paymentMethod
  if (!hasPaymentMethod) blockers.push('Payment method is missing')

  const taxInfoStatus = employee.payrollProfile?.taxId ? 'COMPLETE' : 'MISSING'
  if (taxInfoStatus === 'MISSING') warnings.push('Tax ID is missing')

  const pensionInfoStatus = employee.payrollProfile?.pensionId ? 'COMPLETE' : 'MISSING'
  if (pensionInfoStatus === 'MISSING') warnings.push('Pension ID is missing')

  const hasAssignment = employee.currentRole && employee.employeeCategory
  const assignmentStatus = hasAssignment ? 'COMPLETE' : 'MISSING'
  if (assignmentStatus === 'MISSING') blockers.push('Employee category or role is not assigned')

  const needsManager = !['CEO', 'CLEANING_STAFF', 'SECURITY_STAFF'].includes(employee.currentRole || '')
  const hasManager = !!employee.directManagerId
  const managerStatus = !needsManager ? 'NOT_REQUIRED' : hasManager ? 'COMPLETE' : 'MISSING'
  if (managerStatus === 'MISSING') blockers.push('Direct manager is missing')

  if (!employee.employeeCategory) blockers.push('Employee category is missing')
  if (employee.employeeCategory === 'HEAD_OFFICE' && !employee.currentDepartmentId) {
    blockers.push('Head Office employee must have a department')
  }
  if (employee.employeeCategory === 'SHOP_FIELD' && !employee.currentShopId && ['SHOP_MANAGER', 'DSP', 'DSA', 'SHOP_ACCOUNTANT'].includes(employee.currentRole || '')) {
    blockers.push(`${employee.currentRole} must have a shop`)
  }
  if (employee.currentRole === 'SHOP_ACCOUNTANT' && !employee.accountingReportingManagerId) {
    blockers.push('Shop Accountant must have an accounting reporting manager')
  }

  if (!employee.payrollProfile?.costCenter) warnings.push('Cost center is missing')

  const isInactive = ['RESIGNED', 'TERMINATED', 'EXITED', 'INACTIVE'].includes(employee.employmentStatus || '')
  if (isInactive) warnings.push('Employee is not active')

  let overallStatus: PayrollReadinessResult['overallStatus'] = 'READY'
  if (isInactive) overallStatus = 'INACTIVE'
  else if (blockers.length > 0) overallStatus = 'NOT_READY'
  else if (warnings.length > 0) overallStatus = 'WARNING'

  const totalChecks = 8
  const passedChecks = [
    basicSalaryStatus === 'COMPLETE',
    paymentInfoStatus === 'COMPLETE',
    hasPaymentMethod,
    taxInfoStatus === 'COMPLETE',
    pensionInfoStatus === 'COMPLETE',
    assignmentStatus === 'COMPLETE',
    managerStatus === 'COMPLETE' || managerStatus === 'NOT_REQUIRED',
    !!employee.employeeCategory,
  ].filter(Boolean).length

  return {
    employeeId: employee.employeeId,
    employeeRecordId: employee.id,
    fullName: employee.fullName,
    role: employee.currentRole,
    department: department?.name || null,
    shop: shop?.name || null,
    region: region?.name || null,
    area: area?.name || null,
    employmentStatus: employee.employmentStatus,
    employeeCategory: employee.employeeCategory,
    basicSalaryStatus,
    paymentInfoStatus,
    taxInfoStatus,
    pensionInfoStatus,
    assignmentStatus,
    managerStatus,
    overallStatus,
    readinessPercentage: Math.round((passedChecks / totalChecks) * 100),
    blockers,
    warnings,
  }
}

export async function getPayrollReadinessList(filters: {
  departmentId?: string
  regionId?: string
  areaId?: string
  shopId?: string
  role?: string
  employmentStatus?: string
  readinessStatus?: string
  scopeWhere?: Record<string, unknown>
}): Promise<PayrollReadinessResult[]> {
  const where: Record<string, unknown> = {}
  if (filters.departmentId) where.currentDepartmentId = filters.departmentId
  if (filters.regionId) where.currentRegionId = filters.regionId
  if (filters.areaId) where.currentAreaId = filters.areaId
  if (filters.shopId) where.currentShopId = filters.shopId
  if (filters.role) where.currentRole = filters.role
  if (filters.employmentStatus) where.employmentStatus = filters.employmentStatus

  if (filters.scopeWhere && Object.keys(filters.scopeWhere).length > 0) {
    where.AND = [where.AND, filters.scopeWhere].filter(Boolean)
  }

  const employees = await prisma.employee.findMany({ where, select: { id: true } })
  const results: PayrollReadinessResult[] = []

  for (const emp of employees) {
    const readiness = await getPayrollReadiness(emp.id)
    if (!readiness) continue
    if (filters.readinessStatus && readiness.overallStatus !== filters.readinessStatus) continue
    results.push(readiness)
  }

  return results
}

// ── Calculation Readiness ───────────────────────────────────────────────

export interface ReadinessCheckResult {
  employeeId: string
  blockers: string[]
  warnings: string[]
}

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
