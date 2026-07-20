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

export interface KpiDefaultAmountResult {
  defaultAmount: number
  assignmentId: string
  effectiveFrom: Date
}

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
  prorationMethod: 'NONE' | 'CALENDAR_DAYS' | 'WORKING_DAYS' | 'MANUAL'
}
