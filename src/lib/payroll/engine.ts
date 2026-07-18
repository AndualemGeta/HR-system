import { prisma } from '@/lib/prisma'
import { round2 } from '@/lib/payroll-rounding'
import { resolveSalary, mapSalarySourceToCalculationSource } from './salary'
import { selectPensionRule, getApprovedPensionRules, calcPension, determinePensionableIncome } from './pension'
import { selectPayeBracket, getApprovedPayeBrackets, calcPaye } from './tax'
import { validatePayComponent, processEarningInput, processDeductionInput, getEffectiveKpiDefaultAmount, validateKpiPercentage, processKpiEarning } from './components'
import type { CalculationContext, CalculationResult, CalculationLine, PayComponentInfo } from './types'

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

  const acceptedInputs = await prisma.payrollInput.findMany({
    where: { payrollPeriodId: ctx.payrollPeriodId, employeeId: emp.id, status: 'ACCEPTED', isLocked: true },
    include: { inputType: { include: { payComponent: true } } },
  })

  for (const inp of acceptedInputs) {
    if (inp.inputType.calculationMode === 'METRIC_ONLY') continue

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

  const kpiInputType = await prisma.payrollInputType.findUnique({
    where: { code: 'KPI_ACHIEVEMENT_PERCENT' },
    include: { payComponent: true },
  })
  if (kpiInputType?.payComponent) {
    const kpiComp = kpiInputType.payComponent
    const kpiPc: PayComponentInfo = {
      id: kpiComp.id,
      code: kpiComp.code,
      name: kpiComp.name,
      componentType: kpiComp.componentType,
      isEarning: kpiComp.isEarning,
      isDeduction: kpiComp.isDeduction,
      isPensionable: kpiComp.isPensionable,
      taxablePercent: Number(kpiComp.taxablePercent),
      pensionablePercent: Number(kpiComp.pensionablePercent),
      affectsGross: kpiComp.affectsGross,
      affectsNet: kpiComp.affectsNet,
      affectsEmployerCost: kpiComp.affectsEmployerCost,
      calculationOrder: kpiComp.calculationOrder,
      taxTreatment: kpiComp.taxTreatment,
      isActive: kpiComp.isActive,
      deductionTiming: kpiComp.deductionTiming,
    }

    const kpiInput = acceptedInputs.find(inp => inp.inputType.code === 'KPI_ACHIEVEMENT_PERCENT')
    const kpiAssignment = await getEffectiveKpiDefaultAmount(emp.id, kpiComp.id, ctx.periodEnd)

    if (kpiInput && !kpiAssignment) {
      blockers.push(`MISSING_EFFECTIVE_KPI_DEFAULT_AMOUNT:${kpiComp.code}`)
    } else if (kpiAssignment) {
      if (!kpiPc.isActive) {
        blockers.push(`KPI_COMPONENT_INACTIVE:${kpiComp.code}`)
      } else if (kpiPc.taxTreatment === 'UNKNOWN') {
        blockers.push(`UNKNOWN_KPI_TAX_TREATMENT:${kpiComp.code}`)
      } else {
        const kpiPercentage = kpiInput?.value !== null && kpiInput?.value !== undefined
          ? Number(kpiInput.value)
          : 100
        const percentageErr = validateKpiPercentage(kpiPercentage)
        if (percentageErr) {
          blockers.push(`${percentageErr}:${kpiComp.code}`)
        } else {
          lines.push(processKpiEarning(kpiAssignment.defaultAmount, kpiPercentage, kpiPc))
        }
      }
    }
  }

  const grossSalary = round2(lines.reduce((s, l) => s + l.grossAmount, 0))
  const grossTaxable = round2(lines.reduce((s, l) => s + l.taxableAmount, 0))
  const grossNonTaxable = round2(lines.reduce((s, l) => s + l.nonTaxableAmount, 0))
  const preTaxDeductions = round2(lines.filter(l => l.calculationNote === 'Pre-tax deduction').reduce((s, l) => s + l.deductionAmount, 0))
  const postTaxDeductions = round2(lines.filter(l => l.calculationNote === 'Post-tax deduction').reduce((s, l) => s + l.deductionAmount, 0))

  const payeBrackets = await getApprovedPayeBrackets(ctx.payDate)
  const taxableIncome = round2(grossTaxable - preTaxDeductions)
  const { bracket, blockers: bracketBlockers } = selectPayeBracket(taxableIncome, payeBrackets)
  blockers.push(...bracketBlockers)
  const payeTax = bracket ? calcPaye(taxableIncome, bracket) : 0

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

  const totalDeductions = round2(employeePension + payeTax + preTaxDeductions + postTaxDeductions)
  const netSalary = round2(grossSalary - totalDeductions)
  if (netSalary < 0) blockers.push('NEGATIVE_NET_SALARY')

  const employerTotalCost = round2(grossSalary + employerPension)

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
