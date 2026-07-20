import { prisma } from '@/lib/prisma'
import { roundMoney, money } from '@/lib/money'
import type { CalculationLine } from './types'

async function fetchAllowances(employeeId: string, periodStart: Date, periodEnd: Date): Promise<CalculationLine[]> {
  const allowances = await prisma.payrollAllowance.findMany({
    where: {
      employeeId,
      payrollPeriodStart: periodStart,
      payrollPeriodEnd: periodEnd,
      approvalStatus: 'APPROVED',
    },
  })
  return allowances.map(a => ({
    componentId: null,
    componentCode: 'ALLOWANCE',
    componentName: `Allowance (${a.allowanceType})`,
    lineType: 'ALLOWANCE',
    sourceType: 'ALLOWANCE',
    sourceId: a.id,
    quantity: null,
    rate: null,
    baseAmount: null,
    grossAmount: roundMoney(money(Number(a.amount))),
    taxableAmount: a.isTaxable ? roundMoney(money(Number(a.amount))) : 0,
    nonTaxableAmount: a.isTaxable ? 0 : roundMoney(money(Number(a.amount))),
    pensionableAmount: a.isTaxable ? roundMoney(money(Number(a.amount))) : 0,
    deductionAmount: 0,
    employerAmount: 0,
    calculationOrder: 20,
    calculationNote: null,
  }))
}

async function fetchDeductions(employeeId: string, periodStart: Date, periodEnd: Date): Promise<CalculationLine[]> {
  const deductions = await prisma.payrollDeduction.findMany({
    where: {
      employeeId,
      payrollPeriodStart: periodStart,
      payrollPeriodEnd: periodEnd,
      approvalStatus: 'APPROVED',
    },
  })
  return deductions.map(d => ({
    componentId: null,
    componentCode: 'DEDUCTION',
    componentName: `Deduction (${d.deductionType})`,
    lineType: 'DEDUCTION',
    sourceType: 'DEDUCTION',
    sourceId: d.id,
    quantity: null,
    rate: null,
    baseAmount: null,
    grossAmount: 0,
    taxableAmount: 0,
    nonTaxableAmount: 0,
    pensionableAmount: 0,
    deductionAmount: roundMoney(money(Number(d.amount))),
    employerAmount: 0,
    calculationOrder: 60,
    calculationNote: d.isPreTax ? 'Pre-tax deduction' : 'Post-tax deduction',
  }))
}

async function fetchAdjustments(employeeId: string, periodStart: Date, periodEnd: Date): Promise<CalculationLine[]> {
  const adjustments = await prisma.payrollAdjustment.findMany({
    where: {
      employeeId,
      payrollPeriodStart: periodStart,
      payrollPeriodEnd: periodEnd,
      approvalStatus: 'APPROVED',
    },
  })
  return adjustments.map(a => ({
    componentId: null,
    componentCode: 'ADJUSTMENT',
    componentName: `Adjustment (${a.adjustmentType})`,
    lineType: 'ADJUSTMENT',
    sourceType: 'ADJUSTMENT',
    sourceId: a.id,
    quantity: null,
    rate: null,
    baseAmount: null,
    grossAmount: Number(a.amount) >= 0 ? roundMoney(money(Number(a.amount))) : 0,
    taxableAmount: Number(a.amount) >= 0 ? roundMoney(money(Number(a.amount))) : 0,
    nonTaxableAmount: 0,
    pensionableAmount: 0,
    deductionAmount: Number(a.amount) < 0 ? roundMoney(money(Number(a.amount)).abs()) : 0,
    employerAmount: 0,
    calculationOrder: 30,
    calculationNote: null,
  }))
}

async function fetchCommissions(employeeId: string, periodStart: Date, periodEnd: Date): Promise<CalculationLine[]> {
  const commissions = await prisma.commissionCalculation.findMany({
    where: {
      employeeId,
      periodStart,
      periodEnd,
    },
  })
  return commissions.map(c => ({
    componentId: null,
    componentCode: 'COMMISSION',
    componentName: 'Commission',
    lineType: 'COMMISSION',
    sourceType: 'COMMISSION',
    sourceId: c.id,
    quantity: null,
    rate: null,
    baseAmount: c.salesAmount ? Number(c.salesAmount) : null,
    grossAmount: roundMoney(money(Number(c.calculatedCommission))),
    taxableAmount: roundMoney(money(Number(c.calculatedCommission))),
    nonTaxableAmount: 0,
    pensionableAmount: 0,
    deductionAmount: 0,
    employerAmount: 0,
    calculationOrder: 25,
    calculationNote: c.achievementPercent
      ? `Achievement: ${Number(c.achievementPercent)}%`
      : null,
  }))
}

export interface SourceAdaptersResult {
  allowanceLines: CalculationLine[]
  deductionLines: CalculationLine[]
  adjustmentLines: CalculationLine[]
  commissionLines: CalculationLine[]
  blockers: string[]
}

export async function resolveSourceAdapters(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<SourceAdaptersResult> {
  const blockers: string[] = []
  const [allowanceLines, deductionLines, adjustmentLines, commissionLines] = await Promise.all([
    fetchAllowances(employeeId, periodStart, periodEnd),
    fetchDeductions(employeeId, periodStart, periodEnd),
    fetchAdjustments(employeeId, periodStart, periodEnd),
    fetchCommissions(employeeId, periodStart, periodEnd),
  ])
  return { allowanceLines, deductionLines, adjustmentLines, commissionLines, blockers }
}
