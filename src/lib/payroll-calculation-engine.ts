import { prisma } from './prisma'
import { round2 } from './payroll-rounding'
import type { Prisma } from '@prisma/client'

// ─── Source Type Mapper ────────────────────────────────────────────────

export function mapSalarySourceToCalculationSource(salarySource: string): 'EMPLOYEE_SALARY' | 'SYSTEM' {
  if (salarySource === 'EmployeeSalary') return 'EMPLOYEE_SALARY'
  if (salarySource === 'Employee.basicSalary') return 'SYSTEM'
  return 'SYSTEM'
}

// ─── Interfaces ────────────────────────────────────────────────────────

export interface SalaryResolution {
  basicSalary: number
  salarySource: string
  salaryEffectiveDate: Date | null
}

export interface EmployeeReadiness {
  employeeId: string
  employeeCode: string
  fullName: string
  role: string
  level: string
  status: 'READY' | 'WARNING' | 'BLOCKED'
  blockers: string[]
  warnings: string[]
}

export interface PayComponentInfo {
  id: string
  code: string
  name: string
  componentType: string
  isEarning: boolean
  isDeduction: boolean
  isPensionable: boolean
  taxablePercent: number
  pensionablePercent: number
  affectsGross: boolean
  affectsNet: boolean
  affectsEmployerCost: boolean
  calculationOrder: number
  taxTreatment: string
  isActive: boolean
  deductionTiming: string
}

export function mapComponentTypeToLineType(componentType: string): string {
  switch (componentType) {
    case 'KPI': return 'EARNING'
    case 'TRANSPORT': return 'ALLOWANCE'
    case 'COMMISSION': return 'COMMISSION'
    case 'BONUS': return 'BONUS'
    case 'OVERTIME': return 'OVERTIME'
    case 'ADJUSTMENT': return 'ADJUSTMENT'
    case 'DEDUCTION': return 'DEDUCTION'
    case 'STATUTORY': return 'STATUTORY'
    default: return 'ALLOWANCE'
  }
}

export interface PayeBracket {
  id: string
  minIncome: number
  maxIncome: number | null
  taxRate: number
  deductionAmount: number
}

export interface PensionRuleInfo {
  id: string
  employeeRate: number
  employerRate: number
  pensionBaseType: string
  minimumBase: number | null
  maximumBase: number | null
  priority: number
  applicableRole: string | null
  applicableEmploymentType: string | null
}

export interface CalculationLine {
  componentId: string | null
  componentCode: string
  componentName: string
  lineType: string
  sourceType: string
  sourceId: string | null
  quantity: number | null
  rate: number | null
  baseAmount: number | null
  grossAmount: number
  taxableAmount: number
  nonTaxableAmount: number
  pensionableAmount: number
  deductionAmount: number
  employerAmount: number
  calculationOrder: number
  calculationNote: string | null
}

export interface CalculationResult {
  employeeId: string
  basicSalary: number
  salarySource: string
  salaryEffectiveDate: Date | null
  proratedBasicSalary: number
  grossTaxableEarnings: number
  grossNonTaxableEarnings: number
  pensionableIncome: number
  preTaxDeductions: number
  postTaxDeductions: number
  grossSalary: number
  employeePension: number
  employerPension: number
  taxableIncome: number
  payeTax: number
  totalDeductions: number
  netSalary: number
  employerTotalCost: number
  otherEmployerContributions: number
  lines: CalculationLine[]
  blockers: string[]
  warnings: string[]
}

// ─── Salary ────────────────────────────────────────────────────────────

export async function resolveSalary(employeeId: string, periodEnd: Date): Promise<SalaryResolution> {
  const salary = await prisma.employeeSalary.findFirst({
    where: { employeeId, effectiveDate: { lte: periodEnd } },
    orderBy: { effectiveDate: 'desc' },
  })
  if (salary) {
    return {
      basicSalary: Number(salary.basicSalary),
      salarySource: 'EmployeeSalary',
      salaryEffectiveDate: salary.effectiveDate,
    }
  }
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { basicSalary: true, salaryEffectiveDate: true },
  })
  if (employee?.basicSalary && employee.salaryEffectiveDate && employee.salaryEffectiveDate <= periodEnd) {
    return {
      basicSalary: Number(employee.basicSalary),
      salarySource: 'Employee.basicSalary',
      salaryEffectiveDate: employee.salaryEffectiveDate,
    }
  }
  return { basicSalary: 0, salarySource: 'MISSING', salaryEffectiveDate: null }
}

// ─── Proration ─────────────────────────────────────────────────────────

export function calcProratedSalary(
  basicSalary: number,
  method: string,
  periodDays: number,
  eligibleDays: number,
): { prorated: number; warning?: string } {
  switch (method) {
    case 'NONE':
      return { prorated: basicSalary }
    case 'CALENDAR_DAYS':
      if (periodDays <= 0) return { prorated: basicSalary, warning: 'Invalid period days for proration' }
      return { prorated: round2(basicSalary * eligibleDays / periodDays) }
    case 'WORKING_DAYS': {
      if (periodDays <= 0) return { prorated: basicSalary, warning: 'Invalid working days for proration' }
      return { prorated: round2(basicSalary * eligibleDays / periodDays) }
    }
    case 'MANUAL':
      return { prorated: 0, warning: 'Manual proration requires accepted and locked input' }
    default:
      return { prorated: basicSalary, warning: `Unknown proration method: ${method}` }
  }
}

// ─── Pension ───────────────────────────────────────────────────────────

export function calcPension(pensionableBase: number, rule: PensionRuleInfo): { employeePension: number; employerPension: number } {
  let base = pensionableBase
  if (rule.minimumBase !== null && base < rule.minimumBase) base = rule.minimumBase
  if (rule.maximumBase !== null && base > rule.maximumBase) base = rule.maximumBase
  return {
    employeePension: round2(base * rule.employeeRate / 100),
    employerPension: round2(base * rule.employerRate / 100),
  }
}

// ─── PAYE ──────────────────────────────────────────────────────────────

export function calcPaye(taxableIncome: number, bracket: PayeBracket): number {
  return Math.max(0, round2(taxableIncome * bracket.taxRate / 100 - bracket.deductionAmount))
}

export function selectPayeBracket(taxableIncome: number, brackets: PayeBracket[]): { bracket: PayeBracket | null; blockers: string[] } {
  const blockers: string[] = []
  if (brackets.length === 0) {
    blockers.push('MISSING_PAYE_SCHEDULE')
    return { bracket: null, blockers }
  }
  const matching = brackets.filter(b => {
    if (b.maxIncome === null) return taxableIncome >= b.minIncome
    return taxableIncome >= b.minIncome && taxableIncome < b.maxIncome
  })
  if (matching.length === 0) {
    blockers.push(`Taxable income ${taxableIncome} falls outside any bracket (schedule gap)`)
    return { bracket: null, blockers }
  }
  if (matching.length > 1) {
    blockers.push(`Multiple brackets match taxable income ${taxableIncome}`)
    return { bracket: null, blockers }
  }
  return { bracket: matching[0], blockers }
}

// ─── Pension Rule Selection ────────────────────────────────────────────

export function selectPensionRule(
  rules: PensionRuleInfo[],
  employee: { employmentType?: string | null; role?: string | null },
): { rule: PensionRuleInfo | null; blockers: string[] } {
  const blockers: string[] = []
  if (rules.length === 0) {
    blockers.push('MISSING_PENSION_RULE')
    return { rule: null, blockers }
  }

  // Pre-filter: discard rules where applicableRole/employmentType is set and doesn't match
  const applicable = rules.filter(r => {
    if (r.applicableRole !== null && r.applicableRole !== (employee.role ?? null)) return false
    if (r.applicableEmploymentType !== null && r.applicableEmploymentType !== (employee.employmentType ?? null)) return false
    return true
  })

  if (applicable.length === 0) {
    blockers.push('MISSING_PENSION_RULE')
    return { rule: null, blockers }
  }

  const scored = applicable.map(r => {
    let score = 0
    if (r.applicableRole) score += 10
    if (r.applicableEmploymentType) score += 5
    return { rule: r, score }
  })

  const maxScore = Math.max(...scored.map(s => s.score))
  const topScored = scored.filter(s => s.score === maxScore)

  if (topScored.length === 0) {
    blockers.push('MISSING_PENSION_RULE')
    return { rule: null, blockers }
  }

  const maxPriority = Math.max(...topScored.map(s => s.rule.priority))
  const topPriority = topScored.filter(s => s.rule.priority === maxPriority)

  if (topPriority.length > 1) {
    blockers.push('AMBIGUOUS_PENSION_RULE')
    return { rule: null, blockers }
  }

  return { rule: topPriority[0].rule, blockers }
}

// ─── Statutory Data ────────────────────────────────────────────────────

export async function getApprovedPayeBrackets(payDate: Date): Promise<PayeBracket[]> {
  const brackets = await prisma.payeTaxBracket.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      isSample: false,
      effectiveStartDate: { lte: payDate },
      OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: payDate } }],
    },
    orderBy: { minIncome: 'asc' },
  })
  return brackets.map(b => ({
    id: b.id,
    minIncome: Number(b.minIncome),
    maxIncome: b.maxIncome ? Number(b.maxIncome) : null,
    taxRate: Number(b.taxRate),
    deductionAmount: Number(b.deductionAmount),
  }))
}

export async function getApprovedPensionRules(payDate: Date): Promise<PensionRuleInfo[]> {
  const rules = await prisma.pensionRule.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      isSample: false,
      effectiveStartDate: { lte: payDate },
      OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: payDate } }],
    },
    orderBy: [{ priority: 'desc' }, { effectiveStartDate: 'desc' }],
  })
  return rules.map(r => ({
    id: r.id,
    employeeRate: Number(r.employeeRate),
    employerRate: Number(r.employerRate),
    pensionBaseType: r.pensionBaseType,
    minimumBase: r.minimumBase ? Number(r.minimumBase) : null,
    maximumBase: r.maximumBase ? Number(r.maximumBase) : null,
    priority: r.priority,
    applicableRole: r.applicableRole,
    applicableEmploymentType: r.applicableEmploymentType,
  }))
}

export function determinePensionableIncome(
  proratedBasicSalary: number,
  lines: CalculationLine[],
  baseType: string,
): number {
  switch (baseType) {
    case 'BASIC_SALARY':
      return proratedBasicSalary
    case 'PENSIONABLE_EARNINGS':
      return round2(lines.reduce((sum, l) => sum + (l.pensionableAmount ?? 0), 0))
    default:
      return proratedBasicSalary
  }
}

// ─── Component Validation ──────────────────────────────────────────────

export function validatePayComponent(component: PayComponentInfo): string[] {
  const blockers: string[] = []
  if (!component.isActive) blockers.push('PAY_COMPONENT_INACTIVE')
  if (component.taxTreatment === 'UNKNOWN') blockers.push('UNKNOWN_TAX_TREATMENT')
  if (component.taxablePercent < 0 || component.taxablePercent > 100) {
    blockers.push(`Invalid taxablePercent ${component.taxablePercent}`)
  }
  if (component.pensionablePercent < 0 || component.pensionablePercent > 100) {
    blockers.push(`Invalid pensionablePercent ${component.pensionablePercent}`)
  }
  if (component.isDeduction && component.deductionTiming === 'NOT_APPLICABLE') {
    blockers.push(`DEDUCTION_WITHOUT_TIMING:${component.code}`)
  }
  return blockers
}

// ─── Process a Single Earning Input Line ───────────────────────────────

export function processEarningInput(
  amount: number,
  component: { id: string; code: string; name: string; componentType: string; taxablePercent: number; isPensionable: boolean; pensionablePercent: number; affectsGross: boolean; affectsNet: boolean; affectsEmployerCost: boolean; calculationOrder: number },
  sourceId: string,
): CalculationLine {
  const taxableAmount = round2(amount * Number(component.taxablePercent) / 100)
  const nonTaxableAmount = round2(amount - taxableAmount)
  const pensionableAmount = component.isPensionable
    ? round2(amount * Number(component.pensionablePercent) / 100)
    : 0
  return {
    componentId: component.id,
    componentCode: component.code,
    componentName: component.name,
    lineType: mapComponentTypeToLineType(component.componentType),
    sourceType: 'PAYROLL_INPUT',
    sourceId,
    quantity: null,
    rate: null,
    baseAmount: amount,
    grossAmount: component.affectsGross ? amount : 0,
    taxableAmount,
    nonTaxableAmount,
    pensionableAmount,
    deductionAmount: 0,
    employerAmount: component.affectsEmployerCost ? amount : 0,
    calculationOrder: component.calculationOrder ?? 30,
    calculationNote: component.affectsNet ? null : 'Does not affect net salary',
  }
}

// ─── Process a Single Deduction Input Line ─────────────────────────────

export function processDeductionInput(
  amount: number,
  component: { id: string; code: string; name: string; componentType: string; taxablePercent: number; pensionablePercent: number; affectsGross: boolean; affectsNet: boolean; affectsEmployerCost: boolean; calculationOrder: number; deductionTiming: string },
  sourceId: string,
): CalculationLine {
  return {
    componentId: component.id,
    componentCode: component.code,
    componentName: component.name,
    lineType: mapComponentTypeToLineType(component.componentType),
    sourceType: 'PAYROLL_INPUT',
    sourceId,
    quantity: null,
    rate: null,
    baseAmount: amount,
    grossAmount: 0,
    taxableAmount: 0,
    nonTaxableAmount: 0,
    pensionableAmount: 0,
    deductionAmount: amount,
    employerAmount: 0,
    calculationOrder: component.calculationOrder ?? 60,
    calculationNote: component.deductionTiming === 'PRE_TAX' ? 'Pre-tax deduction' : component.deductionTiming === 'POST_TAX' ? 'Post-tax deduction' : null,
  }
}

// ─── Readiness Check (Per Employee) ────────────────────────────────────

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

  // Salary
  const salary = await resolveSalary(employeeId, periodEnd)
  if (!salary.basicSalary || salary.basicSalary <= 0) {
    blockers.push('MISSING_EFFECTIVE_BASIC_SALARY')
  }

  // Employee status
  if (!employee.employmentStatus || !['ACTIVE', 'ON_PROBATION', 'ON_LEAVE'].includes(employee.employmentStatus)) {
    if (employee.employmentStatus === 'SUSPENDED') blockers.push('INVALID_EMPLOYEE_STATUS')
    else if (['RESIGNED', 'TERMINATED', 'EXITED'].includes(employee.employmentStatus || '')) blockers.push('PARTIAL_PERIOD_EMPLOYEE')
    else blockers.push('INVALID_EMPLOYEE_STATUS')
  }

  // Per-employee input requirements
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

    // Check input type and component
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

  // Approved PAYE schedule
  const payeBrackets = await getApprovedPayeBrackets(payDate)
  if (payeBrackets.length === 0) blockers.push('MISSING_PAYE_SCHEDULE')

  // Approved pension rule
  const pensionRules = await getApprovedPensionRules(payDate)
  const { rule: pr, blockers: prBlockers } = selectPensionRule(pensionRules, {
    employmentType: employee.employmentType,
    role: employee.currentRole,
  })
  blockers.push(...prBlockers)

  return { employeeId, blockers, warnings }
}

// ─── Main Calculation Function ─────────────────────────────────────────

export interface CalculationContext {
  payrollPeriodId: string
  periodStart: Date
  periodEnd: Date
  payDate: Date
  periodName: string
  employees: Array<{
    id: string
    employeeId: string
    fullName: string
    employmentType: string | null
    currentDivisionId: string | null
    currentDepartmentId: string | null
    currentRegionId: string | null
    currentAreaId: string | null
    currentShopId: string | null
    currentRole: string
    currentLevel: string
    employmentStatus: string | null
    employeeCategory: string | null
    basicSalary: number | null
  }>
  prorationMethod: string
}

export async function buildCalculationContext(payrollPeriodId: string, sessionUserId: string): Promise<CalculationContext | null> {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) return null

  const selectedEmployees = await prisma.payrollPeriodEmployee.findMany({
    where: { payrollPeriodId, isSelected: true, removedAt: null },
    include: {
      employee: {
        select: {
          id: true, employeeId: true, fullName: true, employmentType: true,
          currentDivisionId: true, currentDepartmentId: true, currentRegionId: true,
          currentAreaId: true, currentShopId: true, currentRole: true, currentLevel: true,
          employmentStatus: true, employeeCategory: true, basicSalary: true,
        },
      },
    },
  })

  return {
    payrollPeriodId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    payDate: period.payDate,
    periodName: period.periodName,
    employees: selectedEmployees.map(pe => ({
      ...pe.employee,
      basicSalary: pe.employee.basicSalary ? Number(pe.employee.basicSalary) : null,
    })),
    prorationMethod: 'NONE',
  }
}

export async function calculateEmployeePayroll(
  ctx: CalculationContext,
  emp: CalculationContext['employees'][0],
): Promise<CalculationResult> {
  const blockers: string[] = []
  const warnings: string[] = []
  const lines: CalculationLine[] = []

  // Salary
  const salary = await resolveSalary(emp.id, ctx.periodEnd)
  if (!salary.basicSalary || salary.basicSalary <= 0) {
    blockers.push('MISSING_EFFECTIVE_BASIC_SALARY')
  }

  const proratedBasicSalary = salary.basicSalary || 0
  const salSource = mapSalarySourceToCalculationSource(salary.salarySource)

  if (proratedBasicSalary > 0) {
    lines.push({
      componentId: null,
      componentCode: 'BASIC_SALARY',
      componentName: 'Basic Salary',
      lineType: 'BASIC_SALARY',
      sourceType: salSource,
      sourceId: null,
      quantity: null,
      rate: null,
      baseAmount: null,
      grossAmount: proratedBasicSalary,
      taxableAmount: proratedBasicSalary,
      nonTaxableAmount: 0,
      pensionableAmount: proratedBasicSalary,
      deductionAmount: 0,
      employerAmount: 0,
      calculationOrder: 10,
      calculationNote: null,
    })
  }

  // Accepted inputs with component mapping
  const acceptedInputs = await prisma.payrollInput.findMany({
    where: { payrollPeriodId: ctx.payrollPeriodId, employeeId: emp.id, status: 'ACCEPTED', isLocked: true },
    include: { inputType: { include: { payComponent: true } } },
  })

  for (const inp of acceptedInputs) {
    const comp = inp.inputType.payComponent
    if (!comp) {
      blockers.push(`UNMAPPED_PAYROLL_INPUT_TYPE:${inp.inputType.code}`)
      continue
    }

    const pc: PayComponentInfo = {
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
    }

    const compBlockers = validatePayComponent(pc)
    blockers.push(...compBlockers.map(b => `${b}:${comp.code}`))
    if (compBlockers.length > 0) continue

    const amount = inp.amount ? Number(inp.amount) : 0

    if (pc.isDeduction) {
      if (amount < 0) blockers.push(`NEGATIVE_INPUT_AMOUNT:${comp.code}`)
      else lines.push(processDeductionInput(amount, pc, inp.id))
    } else {
      if (amount < 0) blockers.push(`NEGATIVE_INPUT_AMOUNT:${comp.code}`)
      else lines.push(processEarningInput(amount, pc, inp.id))
    }
  }

  // Totals — distinguish pre-tax vs post-tax deductions via deductionTiming stored in calculationNote
  const grossSalary = round2(lines.reduce((s, l) => s + l.grossAmount, 0))
  const grossTaxable = round2(lines.reduce((s, l) => s + l.taxableAmount, 0))
  const grossNonTaxable = round2(lines.reduce((s, l) => s + l.nonTaxableAmount, 0))
  const preTaxDeductions = round2(lines.filter(l => l.calculationNote === 'Pre-tax deduction').reduce((s, l) => s + l.deductionAmount, 0))
  const postTaxDeductions = round2(lines.filter(l => l.calculationNote === 'Post-tax deduction').reduce((s, l) => s + l.deductionAmount, 0))

  // PAYE
  const payeBrackets = await getApprovedPayeBrackets(ctx.payDate)
  const taxableIncome = round2(grossTaxable - preTaxDeductions)
  const { bracket, blockers: bracketBlockers } = selectPayeBracket(taxableIncome, payeBrackets)
  blockers.push(...bracketBlockers)
  const payeTax = bracket ? calcPaye(taxableIncome, bracket) : 0

  // Pension
  const pensionRules = await getApprovedPensionRules(ctx.payDate)
  const { rule: pensionRule, blockers: pensionBlockers } = selectPensionRule(pensionRules, {
    employmentType: emp.employmentType,
    role: emp.currentRole,
  })
  blockers.push(...pensionBlockers)

  const pensionableIncome = pensionRule
    ? determinePensionableIncome(proratedBasicSalary, lines, pensionRule.pensionBaseType)
    : 0
  const { employeePension, employerPension } = pensionRule
    ? calcPension(pensionableIncome, pensionRule)
    : { employeePension: 0, employerPension: 0 }

  // Total deductions
  const totalDeductions = round2(employeePension + payeTax + preTaxDeductions + postTaxDeductions)

  // Net salary (allow negative, blocker will prevent persist)
  const netSalary = round2(grossSalary - totalDeductions)
  if (netSalary < 0) blockers.push('NEGATIVE_NET_SALARY')

  const employerTotalCost = round2(grossSalary + employerPension)

  // Statutory lines
  if (pensionRule && employeePension > 0) {
    lines.push({
      componentId: null,
      componentCode: 'EMPLOYEE_PENSION',
      componentName: 'Employee Pension',
      lineType: 'EMPLOYEE_PENSION',
      sourceType: 'STATUTORY_RULE',
      sourceId: pensionRule.id,
      quantity: null,
      rate: pensionRule.employeeRate,
      baseAmount: pensionableIncome,
      grossAmount: 0,
      taxableAmount: 0,
      nonTaxableAmount: 0,
      pensionableAmount: 0,
      deductionAmount: employeePension,
      employerAmount: 0,
      calculationOrder: 70,
      calculationNote: 'Employee portion',
    })
    lines.push({
      componentId: null,
      componentCode: 'EMPLOYER_PENSION',
      componentName: 'Employer Pension',
      lineType: 'EMPLOYER_PENSION',
      sourceType: 'STATUTORY_RULE',
      sourceId: pensionRule.id,
      quantity: null,
      rate: pensionRule.employerRate,
      baseAmount: pensionableIncome,
      grossAmount: 0,
      taxableAmount: 0,
      nonTaxableAmount: 0,
      pensionableAmount: 0,
      deductionAmount: 0,
      employerAmount: employerPension,
      calculationOrder: 75,
      calculationNote: 'Employer portion',
    })
  }

  if (bracket && payeTax > 0) {
    lines.push({
      componentId: null,
      componentCode: 'PAYE_TAX',
      componentName: 'PAYE Tax',
      lineType: 'PAYE_TAX',
      sourceType: 'STATUTORY_RULE',
      sourceId: bracket.id,
      quantity: null,
      rate: bracket.taxRate,
      baseAmount: taxableIncome,
      grossAmount: 0,
      taxableAmount: 0,
      nonTaxableAmount: 0,
      pensionableAmount: 0,
      deductionAmount: payeTax,
      employerAmount: 0,
      calculationOrder: 80,
      calculationNote: `Bracket: ${bracket.minIncome} - ${bracket.maxIncome ?? 'above'}`,
    })
  }

  return {
    employeeId: emp.id,
    basicSalary: proratedBasicSalary,
    salarySource: salary.salarySource,
    salaryEffectiveDate: salary.salaryEffectiveDate,
    proratedBasicSalary,
    grossTaxableEarnings: grossTaxable,
    grossNonTaxableEarnings: grossNonTaxable,
    pensionableIncome,
    preTaxDeductions,
    postTaxDeductions,
    grossSalary,
    employeePension,
    employerPension,
    taxableIncome,
    payeTax,
    totalDeductions,
    netSalary,
    employerTotalCost,
    otherEmployerContributions: 0,
    lines,
    blockers,
    warnings,
  }
}

// ─── Persist Payroll Calculation ───────────────────────────────────────

export async function persistPayrollCalculation(
  ctx: CalculationContext,
  results: CalculationResult[],
  userId: string,
  version: number,
): Promise<{ batchId: string; totals: Record<string, number> }> {
  const now = new Date()
  let grossTotal = 0, taxTotal = 0, empPensionTotal = 0
  let emprPensionTotal = 0, payeTotal = 0, netTotal = 0, employerCostTotal = 0
  let otherDedTotal = 0
  let blockerCount = 0, warningCount = 0

  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: ctx.payrollPeriodId, status: { not: 'CANCELLED' } },
      orderBy: { version: 'desc' },
    })
    // Supersede any existing non-cancelled batch
    if (existing && existing.version < version) {
      await tx.payrollPreparationBatch.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED', calculationStatus: 'SUPERSEDED', notes: `Superseded by version ${version}` },
      })
    }

    const b = await tx.payrollPreparationBatch.create({
      data: {
        payrollPeriodId: ctx.payrollPeriodId,
        version,
        batchName: `${ctx.periodName} - Calculation v${version}`,
        payrollPeriodStart: ctx.periodStart,
        payrollPeriodEnd: ctx.periodEnd,
        calculationStatus: 'COMPLETED',
        status: 'DRAFT',
        calculationStartedAt: now,
        calculationCompletedAt: now,
        calculatedById: userId,
        employeeCount: results.length,
        createdById: userId,
      },
    })

    for (const r of results) {
      const emp = ctx.employees.find(e => e.id === r.employeeId)
      blockerCount += r.blockers.length > 0 ? 1 : 0
      warningCount += r.warnings.length > 0 ? 1 : 0

      const row = await tx.payrollPreparationRow.create({
        data: {
          batchId: b.id,
          payrollPeriodId: ctx.payrollPeriodId,
          employeeId: r.employeeId,
          employeeCode: emp?.employeeId || '',
          fullName: emp?.fullName || '',
          employmentType: emp?.employmentType || null,
          division: emp?.currentDivisionId || null,
          department: emp?.currentDepartmentId || null,
          region: emp?.currentRegionId || null,
          shop: emp?.currentShopId || null,
          role: emp?.currentRole || '',
          level: emp?.currentLevel || '',
          basicSalary: r.basicSalary,
          salarySource: r.salarySource,
          salaryEffectiveDate: r.salaryEffectiveDate,
          proratedBasicSalary: r.proratedBasicSalary,
          grossTaxableEarnings: r.grossTaxableEarnings,
          grossNonTaxableEarnings: r.grossNonTaxableEarnings,
          pensionableIncome: r.pensionableIncome,
          preTaxDeductions: r.preTaxDeductions,
          postTaxDeductions: r.postTaxDeductions,
          grossSalary: r.grossSalary,
          employeePension: r.employeePension,
          employerPension: r.employerPension,
          taxableIncome: r.taxableIncome,
          payeTax: r.payeTax,
          totalDeductions: r.totalDeductions,
          netSalary: r.netSalary,
          employerTotalCost: r.employerTotalCost,
          readinessStatus: r.blockers.length > 0 ? 'BLOCKED' : r.warnings.length > 0 ? 'WARNING' : 'READY',
          blockers: r.blockers.length > 0 ? JSON.parse(JSON.stringify(r.blockers)) : undefined,
          warnings: r.warnings.length > 0 ? JSON.parse(JSON.stringify(r.warnings)) : undefined,
          calculationVersion: version,
          calculatedAt: now,
          calculatedById: userId,
        },
      })

      for (const l of r.lines) {
        await tx.payrollCalculationLine.create({
          data: {
            batchId: b.id,
            rowId: row.id,
            payrollPeriodId: ctx.payrollPeriodId,
            employeeId: r.employeeId,
            componentId: l.componentId,
            componentCode: l.componentCode,
            componentName: l.componentName,
            lineType: l.lineType as any,
            sourceType: l.sourceType as any,
            sourceId: l.sourceId,
            quantity: l.quantity,
            rate: l.rate,
            baseAmount: l.baseAmount,
            grossAmount: l.grossAmount,
            taxableAmount: l.taxableAmount,
            nonTaxableAmount: l.nonTaxableAmount,
            pensionableAmount: l.pensionableAmount,
            deductionAmount: l.deductionAmount,
            employerAmount: l.employerAmount,
            calculationOrder: l.calculationOrder,
            calculationNote: l.calculationNote,
          },
        })
      }

      // Lock inputs used
      const inputIds = r.lines
        .filter(l => l.sourceType === 'PAYROLL_INPUT' && l.sourceId)
        .map(l => l.sourceId!)
      if (inputIds.length > 0) {
        await tx.payrollInput.updateMany({
          where: { id: { in: inputIds }, payrollPeriodId: ctx.payrollPeriodId },
          data: { isLocked: true, lockedAt: now, lockedById: userId, lockReason: `Batch ${b.id} v${version}` },
        })
      }

      grossTotal = round2(grossTotal + r.grossSalary)
      taxTotal = round2(taxTotal + r.taxableIncome)
      empPensionTotal = round2(empPensionTotal + r.employeePension)
      emprPensionTotal = round2(emprPensionTotal + r.employerPension)
      payeTotal = round2(payeTotal + r.payeTax)
      netTotal = round2(netTotal + r.netSalary)
      employerCostTotal = round2(employerCostTotal + r.employerTotalCost)
      otherDedTotal = round2(otherDedTotal + r.postTaxDeductions)
    }

    await tx.payrollPreparationBatch.update({
      where: { id: b.id },
      data: {
        grossEarningsTotal: grossTotal,
        taxableIncomeTotal: taxTotal,
        employeePensionTotal: empPensionTotal,
        employerPensionTotal: emprPensionTotal,
        payeTaxTotal: payeTotal,
        netSalaryTotal: netTotal,
        employerTotalCost: employerCostTotal,
        otherDeductionTotal: otherDedTotal,
        blockerCount,
        warningCount,
      },
    })

    await tx.payrollPeriod.update({
      where: { id: ctx.payrollPeriodId },
      data: { status: 'READY_FOR_REVIEW' },
    })

    return b
  })

  return {
    batchId: batch.id,
    totals: {
      grossEarningsTotal: grossTotal,
      taxableIncomeTotal: taxTotal,
      employeePensionTotal: empPensionTotal,
      employerPensionTotal: emprPensionTotal,
      payeTaxTotal: payeTotal,
      netSalaryTotal: netTotal,
      employerTotalCost: employerCostTotal,
      otherDeductionTotal: otherDedTotal,
      employeeCount: results.length,
      blockerCount,
      warningCount,
    },
  }
}
