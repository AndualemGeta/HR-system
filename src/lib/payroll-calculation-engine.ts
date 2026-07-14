import { prisma } from './prisma'
import { round2, max0 } from './payroll-rounding'
import type { Prisma } from '@prisma/client'

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

export interface CalculationInputs {
  salary: SalaryResolution
  acceptedInputs: AcceptedInput[]
  payComponent: PayComponentInfo | null
  payeBracket: PayeBracket | null
  pensionRule: PensionRuleInfo | null
}

export interface AcceptedInput {
  id: string
  inputTypeId: string
  inputTypeCode: string
  amount: number
  payComponentId: string | null
}

export interface PayComponentInfo {
  id: string
  code: string
  name: string
  isPensionable: boolean
  taxablePercent: number
  pensionablePercent: number
  affectsGross: boolean
  affectsNet: boolean
  affectsEmployerCost: boolean
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

export interface CalculationLine {
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

export function calcProratedSalary(basicSalary: number, method: string, periodDays: number, eligibleDays: number): { prorated: number; warning?: string } {
  switch (method) {
    case 'NONE':
      return { prorated: basicSalary }
    case 'CALENDAR_DAYS':
      if (periodDays <= 0) return { prorated: basicSalary, warning: 'Invalid period days for proration' }
      return { prorated: round2(basicSalary * eligibleDays / periodDays) }
    case 'WORKING_DAYS': {
      const workingDays = periodDays
      if (workingDays <= 0) return { prorated: basicSalary, warning: 'Invalid working days for proration' }
      return { prorated: round2(basicSalary * eligibleDays / workingDays) }
    }
    default:
      return { prorated: basicSalary, warning: `Unknown proration method: ${method}` }
  }
}

export function calcPension(pensionableBase: number, rule: PensionRuleInfo): { employeePension: number; employerPension: number } {
  let base = pensionableBase
  if (rule.minimumBase !== null && base < rule.minimumBase) base = rule.minimumBase
  if (rule.maximumBase !== null && base > rule.maximumBase) base = rule.maximumBase
  return {
    employeePension: round2(base * rule.employeeRate / 100),
    employerPension: round2(base * rule.employerRate / 100),
  }
}

export function calcPaye(taxableIncome: number, bracket: PayeBracket): number {
  return max0(round2(taxableIncome * bracket.taxRate / 100 - bracket.deductionAmount))
}

export function selectPayeBracket(taxableIncome: number, brackets: PayeBracket[]): { bracket: PayeBracket | null; blockers: string[] } {
  const blockers: string[] = []
  if (brackets.length === 0) {
    blockers.push('No approved active PAYE bracket schedule exists')
    return { bracket: null, blockers }
  }
  const matching = brackets.filter(b => {
    if (b.maxIncome === null) return taxableIncome >= b.minIncome
    return taxableIncome >= b.minIncome && taxableIncome <= b.maxIncome
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

export function selectPensionRule(rules: PensionRuleInfo[], employee: { employmentType?: string | null; role?: string | null }): { rule: PensionRuleInfo | null; blockers: string[] } {
  const blockers: string[] = []
  if (rules.length === 0) {
    blockers.push('No approved active pension rule exists')
    return { rule: null, blockers }
  }

  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  const highestPriority = sorted[0].priority
  const topRules = sorted.filter(r => r.priority === highestPriority)

  if (topRules.length > 1 && topRules.every(r => r.pensionBaseType === topRules[0].pensionBaseType)) {
    return { rule: topRules[0], blockers }
  }

  const specific = sorted.find(r => {
    if (r.applicableRole && r.applicableRole !== (employee.role ?? null)) return false
    if (r.applicableEmploymentType && r.applicableEmploymentType !== (employee.employmentType ?? null)) return false
    return true
  })
  if (specific) return { rule: specific, blockers }

  return { rule: sorted[0], blockers }
}

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
