import { prisma } from '@/lib/prisma'
import { roundMoney, calcPercent, money } from '@/lib/money'
import type { PayComponentInfo, KpiDefaultAmountResult, CalculationLine } from './types'

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

export function processEarningInput(
  amount: number,
  component: { id: string; code: string; name: string; componentType: string; taxablePercent: number; isPensionable: boolean; pensionablePercent: number; affectsGross: boolean; affectsNet: boolean; affectsEmployerCost: boolean; calculationOrder: number },
  sourceId: string,
): CalculationLine {
  const taxableAmount = roundMoney(calcPercent(amount, component.taxablePercent))
  const nonTaxableAmount = roundMoney(money(amount).minus(taxableAmount))
  const pensionableAmount = component.isPensionable
    ? roundMoney(calcPercent(amount, component.pensionablePercent))
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

export async function getEffectiveKpiDefaultAmount(
  employeeId: string,
  payComponentId: string,
  periodEnd: Date,
): Promise<KpiDefaultAmountResult | null> {
  const assignment = await prisma.employeePayComponentAssignment.findFirst({
    where: {
      employeeId,
      payComponentId,
      isActive: true,
      effectiveFrom: { lte: periodEnd },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }] },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (!assignment) return null
  return {
    defaultAmount: Number(assignment.defaultAmount),
    assignmentId: assignment.id,
    effectiveFrom: assignment.effectiveFrom,
  }
}

export function validateKpiPercentage(percentage: number | null): string | null {
  if (percentage === null || percentage === undefined) return null
  if (typeof percentage !== 'number' || isNaN(percentage)) return 'INVALID_KPI_PERCENTAGE'
  if (percentage < 0 || percentage > 100) return 'INVALID_KPI_PERCENTAGE'
  return null
}

export function processKpiEarning(
  defaultAmount: number,
  percentage: number,
  pc: PayComponentInfo,
  sourceId?: string,
): CalculationLine {
  const earned = roundMoney(calcPercent(defaultAmount, percentage))
  const taxableAmount = roundMoney(calcPercent(earned, pc.taxablePercent))
  const nonTaxableAmount = roundMoney(money(earned).minus(taxableAmount))
  const pensionableAmount = pc.isPensionable ? roundMoney(calcPercent(earned, pc.pensionablePercent)) : 0
  return {
    componentId: pc.id,
    componentCode: pc.code,
    componentName: pc.name,
    lineType: 'EARNING',
    sourceType: 'EMPLOYEE_PAY_COMPONENT_ASSIGNMENT',
    sourceId: sourceId ?? null,
    quantity: null,
    rate: percentage,
    baseAmount: defaultAmount,
    grossAmount: pc.affectsGross ? earned : 0,
    taxableAmount,
    nonTaxableAmount,
    pensionableAmount,
    deductionAmount: 0,
    employerAmount: pc.affectsEmployerCost ? earned : 0,
    calculationOrder: pc.calculationOrder ?? 40,
    calculationNote: pc.affectsNet ? null : 'Does not affect net salary',
  }
}

export async function processRuleDerivedInput(
  input: { id: string; value?: string | null | number; amount?: string | number | null },
  component: { id: string; code: string; name: string },
  payDate: Date,
): Promise<{ line: CalculationLine | null; blocker: string | null }> {
  const rule = await prisma.payRule.findFirst({
    where: {
      componentId: component.id,
      status: 'ACTIVE',
      effectiveFrom: { lte: payDate },
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: payDate } }] }],
    },
    orderBy: { priority: 'asc', effectiveFrom: 'desc' },
  })
  if (!rule) return { line: null, blocker: `MISSING_EFFECTIVE_PAY_RULE:${component.code}` }

  const value = input.value ? Number(input.value) : (input.amount ? Number(input.amount) : 0)
  const rate = Number(rule.percentageRate || rule.baseAmount || 0)
  const computedAmount = roundMoney(money(value).mul(rate))
  return {
    line: {
      componentId: component.id,
      componentCode: component.code,
      componentName: component.name,
      lineType: 'ALLOWANCE',
      sourceType: 'PAY_RULE',
      sourceId: rule.id,
      quantity: null,
      rate,
      baseAmount: value,
      grossAmount: computedAmount,
      taxableAmount: computedAmount,
      nonTaxableAmount: 0,
      pensionableAmount: 0,
      deductionAmount: 0,
      employerAmount: 0,
      calculationOrder: 50,
      calculationNote: `Rule-derived: ${rule.name}`,
    },
    blocker: null,
  }
}
