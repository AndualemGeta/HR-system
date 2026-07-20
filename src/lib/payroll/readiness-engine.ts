import { prisma } from '@/lib/prisma'
import { resolveSalary, resolveProrationPolicy } from './salary'
import { selectPensionRule, getApprovedPensionRules } from './pension'
import { getApprovedPayeBrackets } from './tax'
import { validatePayComponent, getEffectiveKpiDefaultAmount } from './components'

// ── Dashboard Readiness (kept for employee payroll-readiness dashboard) ──

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

// ── Shared Payroll Period Readiness ──────────────────────────────────────

export interface EmployeeReadinessResult {
  employeeId: string
  employeeCode: string
  fullName: string
  status: 'READY' | 'WARNING' | 'BLOCKED'
  blockers: string[]
  warnings: string[]
}

export interface PayrollPeriodReadinessResult {
  payrollPeriodId: string
  readyForCalculation: boolean
  selectedEmployeeCount: number
  readyEmployeeCount: number
  warningEmployeeCount: number
  blockedEmployeeCount: number
  periodBlockers: string[]
  periodWarnings: string[]
  employeeResults: EmployeeReadinessResult[]
}

const ACCEPTABLE_INPUT_STATUSES = ['ACCEPTED']

function requirementMatchesEmployee(req: {
  employeeCategory: string | null
  role: string | null
  departmentId: string | null
  regionId: string | null
  areaId: string | null
  shopId: string | null
  employmentType: string | null
}, emp: {
  employeeCategory: string | null | undefined
  currentRole: string | null | undefined
  currentDepartmentId: string | null | undefined
  currentRegionId: string | null | undefined
  currentAreaId: string | null | undefined
  currentShopId: string | null | undefined
  employmentType: string | null | undefined
}): boolean {
  const allNull = !req.employeeCategory && !req.role && !req.departmentId && !req.regionId && !req.areaId && !req.shopId && !req.employmentType
  if (allNull) return true
  if (req.employeeCategory && req.employeeCategory !== (emp.employeeCategory ?? null)) return false
  if (req.role && req.role !== (emp.currentRole ?? null)) return false
  if (req.departmentId && req.departmentId !== (emp.currentDepartmentId ?? null)) return false
  if (req.regionId && req.regionId !== (emp.currentRegionId ?? null)) return false
  if (req.areaId && req.areaId !== (emp.currentAreaId ?? null)) return false
  if (req.shopId && req.shopId !== (emp.currentShopId ?? null)) return false
  if (req.employmentType && req.employmentType !== (emp.employmentType ?? null)) return false
  return true
}

export async function evaluatePayrollPeriodReadiness(options: {
  payrollPeriodId: string
  userId?: string
  includeEmployeeDetails?: boolean
}): Promise<PayrollPeriodReadinessResult> {
  const { payrollPeriodId, includeEmployeeDetails } = options

  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) {
    return {
      payrollPeriodId,
      readyForCalculation: false,
      selectedEmployeeCount: 0,
      readyEmployeeCount: 0,
      warningEmployeeCount: 0,
      blockedEmployeeCount: 0,
      periodBlockers: ['PAYROLL_PERIOD_NOT_FOUND'],
      periodWarnings: [],
      employeeResults: [],
    }
  }

  const selectedPeriodEmployees = await prisma.payrollPeriodEmployee.findMany({
    where: { payrollPeriodId, isSelected: true, removedAt: null },
    include: {
      employee: {
        include: { payrollProfile: true },
      },
    },
  })

  if (selectedPeriodEmployees.length === 0) {
    return {
      payrollPeriodId,
      readyForCalculation: false,
      selectedEmployeeCount: 0,
      readyEmployeeCount: 0,
      warningEmployeeCount: 0,
      blockedEmployeeCount: 0,
      periodBlockers: ['NO_SELECTED_EMPLOYEES'],
      periodWarnings: [],
      employeeResults: [],
    }
  }

  // Load all active requirements (not per-employee OR query — loads all)
  const allRequirements = await prisma.payrollInputRequirement.findMany({
    where: { isActive: true },
    include: { inputType: { include: { payComponent: true } } },
  })

  // Load all inputs for this period once
  const allInputs = await prisma.payrollInput.findMany({
    where: { payrollPeriodId },
    include: { inputType: { include: { payComponent: true } } },
  })
  const inputsByEmployee = new Map<string, typeof allInputs>()
  for (const inp of allInputs) {
    const arr = inputsByEmployee.get(inp.employeeId) || []
    arr.push(inp)
    inputsByEmployee.set(inp.employeeId, arr)
  }

  // Load all waivers once
  const allWaivers = await prisma.payrollInputWaiver.findMany({
    where: { payrollPeriodId, isActive: true },
  })
  const waiversByEmployee = new Map<string, typeof allWaivers>()
  for (const w of allWaivers) {
    const arr = waiversByEmployee.get(w.employeeId) || []
    arr.push(w)
    waiversByEmployee.set(w.employeeId, arr)
  }

  // Load global configs once
  const payeBrackets = await getApprovedPayeBrackets(period.payDate)
  const pensionRules = await getApprovedPensionRules(period.payDate)

  const periodBlockers: string[] = []
  const periodWarnings: string[] = []

  if (payeBrackets.length === 0) periodBlockers.push('MISSING_PAYE_SCHEDULE')

  // Pre-fetch KPI input type once
  const kpiInputType = await prisma.payrollInputType.findUnique({
    where: { code: 'KPI_ACHIEVEMENT_PERCENT' },
    include: { payComponent: true },
  })

  let readyCount = 0
  let warningCount = 0
  let blockedCount = 0
  const employeeResults: EmployeeReadinessResult[] = []

  for (const pe of selectedPeriodEmployees) {
    const emp = pe.employee
    const empBlockers: string[] = []
    const empWarnings: string[] = []

    // ── 1. Effective salary > 0 ───────────────────────────────────────────
    const salary = await resolveSalary(emp.id, period.periodEnd)
    if (!salary.basicSalary || salary.basicSalary <= 0) {
      empBlockers.push('MISSING_EFFECTIVE_BASIC_SALARY')
    }

    // ── 2. Employee status eligible ────────────────────────────────────────
    const eligibleStatuses = ['ACTIVE', 'ON_PROBATION', 'ON_LEAVE']
    if (!emp.employmentStatus || !eligibleStatuses.includes(emp.employmentStatus)) {
      if (emp.employmentStatus === 'SUSPENDED') empBlockers.push('INVALID_EMPLOYEE_STATUS')
      else if (['RESIGNED', 'TERMINATED', 'EXITED'].includes(emp.employmentStatus || '')) empBlockers.push('PARTIAL_PERIOD_EMPLOYEE')
      else empBlockers.push('INVALID_EMPLOYEE_STATUS')
    }

    // ── 3. Payroll profile exists ─────────────────────────────────────────
    if (!emp.payrollProfile) {
      empBlockers.push('MISSING_PAYROLL_PROFILE')
    }

    // ── 4. Required payment information ────────────────────────────────────
    const hasPaymentInfo = emp.payrollProfile && (emp.payrollProfile.bankAccountNumber || emp.payrollProfile.mpesaAccount)
    if (!hasPaymentInfo) {
      empBlockers.push('MISSING_PAYMENT_INFORMATION')
    }
    if (!emp.payrollProfile?.paymentMethod) {
      empBlockers.push('MISSING_PAYMENT_METHOD')
    }

    // ── 5. Proration readiness ──────────────────────────────────────────────
    const prorationMethod = await resolveProrationPolicy(payrollPeriodId)
    if (prorationMethod === 'WORKING_DAYS') {
      const attendance = await prisma.payrollAttendanceInput.findFirst({
        where: { employeeId: emp.id, payrollPeriodStart: period.periodStart, payrollPeriodEnd: period.periodEnd },
      })
      const wd = attendance?.workingDays ? Number(attendance.workingDays) : 0
      if (wd <= 0) {
        empBlockers.push('MISSING_ATTENDANCE_INPUT')
      }
    } else if (prorationMethod === 'MANUAL') {
      const manualInput = allInputs.find(
        inp => inp.employeeId === emp.id && inp.inputType.code === 'MANUAL_PRORATION'
      )
      if (!manualInput || manualInput.status !== 'ACCEPTED' || !manualInput.isLocked) {
        empBlockers.push('MISSING_MANUAL_PRORATION_INPUT')
      }
    } else if (prorationMethod !== 'NONE' && prorationMethod !== 'CALENDAR_DAYS') {
      empBlockers.push('INVALID_PRORATION_POLICY')
    }

    // ── 6. Required input checks ───────────────────────────────────────────
    const empInputs = inputsByEmployee.get(emp.id) || []
    const empInputsByType = new Map(empInputs.map(i => [i.inputTypeId, i]))
    const empWaivers = waiversByEmployee.get(emp.id) || []
    const waivedTypeIds = new Set(empWaivers.map(w => w.inputTypeId))

    for (const req of allRequirements) {
      if (!requirementMatchesEmployee(req, emp)) continue

      const existingInput = empInputsByType.get(req.inputTypeId)

      if (req.severity === 'BLOCKER') {
        if (!existingInput && !waivedTypeIds.has(req.inputTypeId)) {
          empBlockers.push(`MISSING_REQUIRED_INPUT:${req.inputType.code}`)
        } else if (existingInput && !ACCEPTABLE_INPUT_STATUSES.includes(existingInput.status)) {
          empBlockers.push(`INPUT_NOT_ACCEPTED:${req.inputType.code}`)
        } else if (existingInput && ACCEPTABLE_INPUT_STATUSES.includes(existingInput.status) && !existingInput.isLocked) {
          empBlockers.push(`INPUT_NOT_LOCKED:${req.inputType.code}`)
        }
      } else if (req.severity === 'WARNING') {
        if (!existingInput && !waivedTypeIds.has(req.inputTypeId)) {
          empWarnings.push(`MISSING_REQUIRED_INPUT:${req.inputType.code}`)
        } else if (existingInput && !ACCEPTABLE_INPUT_STATUSES.includes(existingInput.status)) {
          empWarnings.push(`INPUT_NOT_ACCEPTED:${req.inputType.code}`)
        } else if (existingInput && ACCEPTABLE_INPUT_STATUSES.includes(existingInput.status) && !existingInput.isLocked) {
          empWarnings.push(`INPUT_NOT_LOCKED:${req.inputType.code}`)
        }
      }
    }

    // ── 6. Optional input validation ───────────────────────────────────────
    for (const inp of empInputs) {
      if (!inp.inputType) continue

      if (ACCEPTABLE_INPUT_STATUSES.includes(inp.status) && !inp.isLocked) {
        empBlockers.push(`INPUT_NOT_LOCKED:${inp.inputType.code}`)
      }

      if (!inp.inputType.isActive) {
        empBlockers.push(`INPUT_TYPE_INACTIVE:${inp.inputType.code}`)
      }

      if (!inp.inputType.payComponentId) {
        empBlockers.push(`UNMAPPED_PAYROLL_INPUT_TYPE:${inp.inputType.code}`)
      }

      if (inp.inputType.payComponent && !inp.inputType.payComponent.isActive) {
        empBlockers.push(`PAY_COMPONENT_INACTIVE:${inp.inputType.code}`)
      }

      if (inp.inputType.calculationMode === 'METRIC_ONLY' && inp.amount && Number(inp.amount) > 0) {
        empBlockers.push(`NON_AMOUNT_INPUT_REQUIRES_RULE:${inp.inputType.code}`)
      }

      if (inp.inputType.calculationMode === 'RULE_DERIVED' && inp.inputType.payComponent) {
        const effectiveRule = await prisma.payRule.findFirst({
          where: {
            componentId: inp.inputType.payComponent.id,
            status: 'ACTIVE',
            effectiveFrom: { lte: period.payDate },
            AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.payDate } }] }],
          },
          orderBy: { priority: 'asc', effectiveFrom: 'desc' },
        })
        if (!effectiveRule) {
          empBlockers.push(`MISSING_EFFECTIVE_PAY_RULE:${inp.inputType.code}`)
        }
      }

      if (inp.inputType.payComponent) {
        const comp = inp.inputType.payComponent
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
        for (const cb of compBlockers) {
          empBlockers.push(`${cb}:${comp.code}`)
        }
      }
    }

    // ── 7. KPI readiness ───────────────────────────────────────────────────
    if (kpiInputType?.payComponent) {
      const kpiComp = kpiInputType.payComponent
      const kpiAssignment = await getEffectiveKpiDefaultAmount(emp.id, kpiComp.id, period.periodEnd)
      const kpiInput = empInputs.find(inp => inp.inputType.code === 'KPI_ACHIEVEMENT_PERCENT')

      if (kpiAssignment && !kpiInput) {
        // Active assignment + no input → ready (default 100%)
      } else if (kpiAssignment && kpiInput && ACCEPTABLE_INPUT_STATUSES.includes(kpiInput.status) && kpiInput.isLocked) {
        // Active assignment + accepted locked input → ready
      } else if (kpiAssignment && kpiInput && (!ACCEPTABLE_INPUT_STATUSES.includes(kpiInput.status) || !kpiInput.isLocked)) {
        // Active assignment + non-accepted or unlocked → block
        empBlockers.push(`KPI_INPUT_NOT_READY:${kpiComp.code}`)
      } else if (!kpiAssignment && !kpiInput) {
        // No assignment + no input → ready, no KPI payment
      } else if (!kpiAssignment && kpiInput) {
        // No assignment + input exists → block
        empBlockers.push(`MISSING_EFFECTIVE_KPI_DEFAULT_AMOUNT:${kpiComp.code}`)
      }
    }

    // ── 8. Pension rule (per employee, role-specific) ─────────────────────
    const { rule: empPensionRule, blockers: empPensionBlockers } = selectPensionRule(pensionRules, {
      employmentType: emp.employmentType,
      role: emp.currentRole,
    })
    empBlockers.push(...empPensionBlockers)

    // ── Determine status ───────────────────────────────────────────────────
    let status: 'READY' | 'WARNING' | 'BLOCKED' = 'READY'
    if (empBlockers.length > 0) {
      status = 'BLOCKED'
      blockedCount++
    } else if (empWarnings.length > 0) {
      status = 'WARNING'
      warningCount++
    } else {
      readyCount++
    }

    employeeResults.push({
      employeeId: emp.id,
      employeeCode: emp.employeeId,
      fullName: emp.fullName,
      status,
      blockers: empBlockers,
      warnings: empWarnings,
    })
  }

  // ── Overall readiness ───────────────────────────────────────────────────
  const hasUnlockedAccepted = allInputs.some(
    inp => ACCEPTABLE_INPUT_STATUSES.includes(inp.status) && !inp.isLocked,
  )
  if (hasUnlockedAccepted) {
    periodBlockers.push('UNLOCKED_ACCEPTED_INPUTS_EXIST')
  }

  const readyForCalculation =
    selectedPeriodEmployees.length > 0 &&
    blockedCount === 0 &&
    periodBlockers.length === 0 &&
    !hasUnlockedAccepted

  return {
    payrollPeriodId,
    readyForCalculation,
    selectedEmployeeCount: selectedPeriodEmployees.length,
    readyEmployeeCount: readyCount,
    warningEmployeeCount: warningCount,
    blockedEmployeeCount: blockedCount,
    periodBlockers,
    periodWarnings,
    employeeResults: includeEmployeeDetails ? employeeResults : [],
  }
}

// ── Old checkEmployeeReadiness (deprecated — delegates to shared) ────────

export interface ReadinessCheckResult {
  employeeId: string
  blockers: string[]
  warnings: string[]
}

export async function checkEmployeeReadiness(
  employeeId: string,
  _employee: { employmentStatus?: string | null; employmentType?: string | null; currentRole?: string | null; employeeCategory?: string | null; currentDepartmentId?: string | null; currentRegionId?: string | null; currentAreaId?: string | null; currentShopId?: string | null },
  payrollPeriodId: string,
  _periodEnd: Date,
  _payDate: Date,
): Promise<ReadinessCheckResult> {
  const result = await evaluatePayrollPeriodReadiness({
    payrollPeriodId,
    includeEmployeeDetails: true,
  })
  const empResult = result.employeeResults.find(r => r.employeeId === employeeId)
  if (empResult) {
    return { employeeId, blockers: empResult.blockers, warnings: empResult.warnings }
  }
  return { employeeId, blockers: ['EMPLOYEE_NOT_FOUND_IN_PERIOD'], warnings: [] }
}
