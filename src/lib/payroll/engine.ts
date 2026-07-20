import { prisma } from '@/lib/prisma'
import { roundMoney, sumMoney, money, validateReconciliation } from '@/lib/money'
import { resolveSalary, mapSalarySourceToCalculationSource, calcProratedSalary, resolveProrationPolicy } from './salary'
import { selectPensionRule, getApprovedPensionRules, calcPension, determinePensionableIncome } from './pension'
import { selectPayeBracket, getApprovedPayeBrackets, calcPaye } from './tax'
import { validatePayComponent, processEarningInput, processDeductionInput, getEffectiveKpiDefaultAmount, validateKpiPercentage, processKpiEarning, processRuleDerivedInput } from './components'
import { resolveSourceAdapters } from './sources'
import type { CalculationContext, CalculationResult, CalculationLine, PayComponentInfo } from './types'

export async function buildCalculationContext(payrollPeriodId: string): Promise<CalculationContext | null> {
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

  const prorationMethod = await resolveProrationPolicy(payrollPeriodId)

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
    prorationMethod,
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
  const basicSalary = salary.basicSalary || 0
  if (basicSalary <= 0) {
    blockers.push('MISSING_EFFECTIVE_BASIC_SALARY')
  }

  // ── Proration ──
  const periodDays = Math.ceil((ctx.periodEnd.getTime() - ctx.periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  let eligibleDays = periodDays

  if (ctx.prorationMethod === 'WORKING_DAYS') {
    const attendance = await prisma.payrollAttendanceInput.findFirst({
      where: { employeeId: emp.id, payrollPeriodStart: ctx.periodStart, payrollPeriodEnd: ctx.periodEnd },
    })
    const wd = attendance?.workingDays ? Number(attendance.workingDays) : 0
    if (wd > 0) {
      eligibleDays = wd
    } else {
      blockers.push('MISSING_ATTENDANCE_INPUT')
    }
    if (eligibleDays <= 0 || eligibleDays > periodDays) {
      blockers.push('INVALID_WORKING_DAYS')
    }
  }

  if (ctx.prorationMethod === 'MANUAL') {
    const manualInput = await prisma.payrollInput.findFirst({
      where: { payrollPeriodId: ctx.payrollPeriodId, employeeId: emp.id, inputType: { code: 'MANUAL_PRORATION' } },
    })
    if (manualInput && manualInput.status === 'ACCEPTED' && manualInput.isLocked) {
      eligibleDays = Number(manualInput.value) || 1
    } else {
      blockers.push('MISSING_MANUAL_PRORATION_INPUT')
    }
    if (eligibleDays <= 0 || eligibleDays > periodDays) {
      blockers.push('INVALID_PRORATION_VALUE')
    }
  }

  const proratedBasicSalary = calcProratedSalary(basicSalary, ctx.prorationMethod, periodDays, eligibleDays)
  if (proratedBasicSalary.warning) warnings.push(proratedBasicSalary.warning)
  const pbs = proratedBasicSalary.prorated

  const salSource = mapSalarySourceToCalculationSource(salary.salarySource)

  if (pbs > 0) {
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
      grossAmount: pbs,
      taxableAmount: pbs,
      nonTaxableAmount: 0,
      pensionableAmount: pbs,
      deductionAmount: 0,
      employerAmount: 0,
      calculationOrder: 10,
      calculationNote: ctx.prorationMethod !== 'NONE' ? `Proration: ${ctx.prorationMethod} (${eligibleDays}/${periodDays})` : null,
    })
  }

  const { allowanceLines, deductionLines, adjustmentLines, commissionLines } = await resolveSourceAdapters(emp.id, ctx.periodStart, ctx.periodEnd)
  for (const al of [...allowanceLines, ...adjustmentLines, ...commissionLines, ...deductionLines]) lines.push(al)

  const acceptedInputs = await prisma.payrollInput.findMany({
    where: { payrollPeriodId: ctx.payrollPeriodId, employeeId: emp.id, status: 'ACCEPTED', isLocked: true },
    include: { inputType: { include: { payComponent: true } } },
  })

  const processedComponentCodes = new Set<string>()

  for (const inp of acceptedInputs) {
    if (inp.inputType.calculationMode === 'RULE_DERIVED') {
      const comp = inp.inputType.payComponent
      if (!comp) {
        blockers.push(`UNMAPPED_PAYROLL_INPUT_TYPE:${inp.inputType.code}`)
        continue
      }
      const ruleLine = await processRuleDerivedInput(
        { id: inp.id, value: inp.value ? String(inp.value) : undefined, amount: inp.amount ? Number(inp.amount) : undefined },
        comp,
        ctx.payDate,
      )
      if (!ruleLine) {
        blockers.push(`MISSING_EFFECTIVE_PAY_RULE:${comp.code}`)
        continue
      }
      if (ruleLine.blocker) {
        blockers.push(ruleLine.blocker)
        continue
      }
      if (ruleLine.line) {
        lines.push(ruleLine.line)
        if (comp.code) processedComponentCodes.add(comp.code)
      }
      continue
    }

    if (inp.inputType.calculationMode === 'METRIC_ONLY') {
      if (inp.amount && Number(inp.amount) > 0) {
        blockers.push(`NON_AMOUNT_INPUT_REQUIRES_RULE:${inp.inputType.code}`)
      }
      continue
    }

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
      else {
        lines.push(processDeductionInput(amount, pc, inp.id))
        processedComponentCodes.add(comp.code)
      }
    } else {
      if (amount < 0) blockers.push(`NEGATIVE_INPUT_AMOUNT:${comp.code}`)
      else {
        lines.push(processEarningInput(amount, pc, inp.id))
        processedComponentCodes.add(comp.code)
      }
    }
  }

  // ── KPI processing ──
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
          processedComponentCodes.add(kpiComp.code)
        }
      }
    }
  }

  // ── Duplicate component code from input + other-source detection ──
  const seenCodes = new Map<string, string[]>()
  for (const line of lines) {
    const code = line.componentCode
    if (!seenCodes.has(code)) seenCodes.set(code, [])
    seenCodes.get(code)!.push(line.sourceType)
  }
  for (const [code, sources] of seenCodes) {
    if (new Set(sources).size > 1) {
      blockers.push(`DUPLICATE_COMPONENT_SOURCE:${code}`)
    }
  }

  // ── Totals (decimal-safe) ──
  const grossSalary = sumMoney(...lines.map(l => l.grossAmount))
  const grossTaxable = sumMoney(...lines.map(l => l.taxableAmount))
  const grossNonTaxable = sumMoney(...lines.map(l => l.nonTaxableAmount))
  const preTaxDeductions = sumMoney(...lines.filter(l => l.calculationNote === 'Pre-tax deduction').map(l => l.deductionAmount))
  const postTaxDeductions = sumMoney(...lines.filter(l => l.calculationNote === 'Post-tax deduction').map(l => l.deductionAmount))

  const payeBrackets = await getApprovedPayeBrackets(ctx.payDate)
  const taxableIncome = roundMoney(money(grossTaxable).minus(preTaxDeductions))
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
    ? determinePensionableIncome(pbs, lines, pensionRule.pensionBaseType)
    : 0
  const { employeePension, employerPension } = pensionRule
    ? calcPension(pensionableIncome, pensionRule)
    : { employeePension: 0, employerPension: 0 }

  const totalDeductions = sumMoney(employeePension, payeTax, preTaxDeductions, postTaxDeductions)
  const netSalary = roundMoney(money(grossSalary).minus(totalDeductions))
  if (netSalary < 0) blockers.push('NEGATIVE_NET_SALARY')

  const otherEmployerContributions = sumMoney(...lines.filter(l => l.employerAmount > 0 && l.lineType !== 'EMPLOYER_PENSION').map(l => l.employerAmount))
  const employerTotalCost = roundMoney(money(grossSalary).plus(employerPension).plus(otherEmployerContributions))

  // ── Line additions: pension, PAYE ──
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

  // ── Reconciliation ──
  const reconIssues: string[] = []
  const grossFromLines = sumMoney(...lines.map(l => l.grossAmount))
  const grossRecon = validateReconciliation('Gross salary', grossFromLines, grossSalary)
  if (grossRecon) reconIssues.push(grossRecon)

  const taxableFromLines = sumMoney(...lines.map(l => l.taxableAmount))
  const taxableRecon = validateReconciliation('Taxable earnings', taxableFromLines, grossTaxable)
  if (taxableRecon) reconIssues.push(taxableRecon)

  const deductionFromLines = sumMoney(...lines.filter(l => l.deductionAmount > 0).map(l => l.deductionAmount))
  const deductionRecon = validateReconciliation('Total deductions', deductionFromLines, totalDeductions)
  if (deductionRecon) reconIssues.push(deductionRecon)

  const netCheck = roundMoney(money(grossSalary).minus(totalDeductions))
  const netRecon = validateReconciliation('Net salary', netCheck, netSalary)
  if (netRecon) reconIssues.push(netRecon)

  const employerLineTotal = sumMoney(...lines.map(l => l.employerAmount))
  const employerTotal = roundMoney(money(grossSalary).plus(employerLineTotal))
  const employerRecon = validateReconciliation('Employer total cost', employerTotal, employerTotalCost)
  if (employerRecon) reconIssues.push(employerRecon)

  if (reconIssues.length > 0) {
    blockers.push('PAYROLL_RECONCILIATION_FAILED')
    for (const issue of reconIssues) {
      blockers.push(`RECON_MISMATCH:${issue}`)
    }
  }

  return {
    employeeId: emp.id,
    basicSalary,
    salarySource: salary.salarySource,
    salaryEffectiveDate: salary.salaryEffectiveDate,
    proratedBasicSalary: pbs,
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
    otherEmployerContributions,
    lines,
    blockers,
    warnings,
  }
}
