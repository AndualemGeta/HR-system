import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import {
  resolveSalary, selectPayeBracket, selectPensionRule,
  calcPaye, calcPension, determinePensionableIncome,
  getApprovedPayeBrackets, getApprovedPensionRules,
  type CalculationResult, type CalculationLine,
} from '@/lib/payroll-calculation-engine'
import { round2, sum, max0 } from '@/lib/payroll-rounding'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.calculate'))) return forbidden()

    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY_FOR_CALCULATION') return badRequest(`Period status is ${period.status}, expected READY_FOR_CALCULATION`)

    const selectedEmployees = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true, removedAt: null },
      include: { employee: true },
    })
    if (selectedEmployees.length === 0) return badRequest('No selected employees')

    const payeBrackets = await getApprovedPayeBrackets(period.payDate)
    const pensionRules = await getApprovedPensionRules(period.payDate)

    const results: CalculationResult[] = []
    const allLines: Array<CalculationLine & { employeeId: string }> = []
    let allBlocked = false

    for (const pe of selectedEmployees) {
      const emp = pe.employee
      const salary = await resolveSalary(emp.id, period.periodEnd)
      const blockers: string[] = []
      const warnings: string[] = []
      const lines: CalculationLine[] = []

      if (!salary.basicSalary || salary.basicSalary <= 0) blockers.push('MISSING_EFFECTIVE_BASIC_SALARY')

      const proratedBasicSalary = salary.basicSalary || 0
      if (proratedBasicSalary > 0) {
        lines.push({
          componentCode: 'BASIC_SALARY', componentName: 'Basic Salary',
          lineType: 'BASIC_SALARY', sourceType: salary.salarySource as never,
          sourceId: null, quantity: null, rate: null, baseAmount: null,
          grossAmount: proratedBasicSalary,
          taxableAmount: proratedBasicSalary,
          nonTaxableAmount: 0, pensionableAmount: proratedBasicSalary,
          deductionAmount: 0, employerAmount: 0,
          calculationOrder: 10, calculationNote: null,
        })
      }

      const acceptedInputs = await prisma.payrollInput.findMany({
        where: { payrollPeriodId: id, employeeId: emp.id, status: 'ACCEPTED', isLocked: true },
        include: { inputType: true },
      })
      for (const inp of acceptedInputs) {
        const amount = inp.amount ? Number(inp.amount) : 0
        if (amount > 0) {
          lines.push({
            componentCode: inp.inputType.code, componentName: inp.inputType.name,
            lineType: 'ALLOWANCE', sourceType: 'PAYROLL_INPUT' as never,
            sourceId: inp.id, quantity: null, rate: null, baseAmount: null,
            grossAmount: amount, taxableAmount: amount,
            nonTaxableAmount: 0, pensionableAmount: amount,
            deductionAmount: 0, employerAmount: 0,
            calculationOrder: 30, calculationNote: null,
          })
        }
      }

      const grossSalary = round2(lines.reduce((s, l) => s + l.grossAmount, 0))
      const grossTaxable = round2(lines.reduce((s, l) => s + l.taxableAmount, 0))
      const grossNonTaxable = round2(lines.reduce((s, l) => s + l.nonTaxableAmount, 0))

      const { bracket, blockers: bracketBlockers } = selectPayeBracket(grossTaxable, payeBrackets)
      blockers.push(...bracketBlockers)

      const { rule: pensionRule, blockers: pensionBlockers } = selectPensionRule(pensionRules, { employmentType: emp.employmentType, role: emp.currentRole })
      blockers.push(...pensionBlockers)

      const pensionableIncome = pensionRule
        ? determinePensionableIncome(proratedBasicSalary, lines, pensionRule.pensionBaseType)
        : 0
      const { employeePension, employerPension } = pensionRule
        ? calcPension(pensionableIncome, pensionRule)
        : { employeePension: 0, employerPension: 0 }

      const preTaxDeductions = 0
      const taxableIncome = max0(round2(grossTaxable - preTaxDeductions))
      const payeTax = bracket ? calcPaye(taxableIncome, bracket) : 0

      const postTaxDeductions = 0
      const totalDeductions = round2(employeePension + payeTax + postTaxDeductions)
      const netSalary = max0(round2(grossSalary - totalDeductions))
      const employerTotalCost = round2(grossSalary + employerPension)

      if (pensionRule && employeePension > 0) {
        lines.push({
          componentCode: 'EMPLOYEE_PENSION', componentName: 'Employee Pension',
          lineType: 'EMPLOYEE_PENSION', sourceType: 'STATUTORY_RULE' as never,
          sourceId: pensionRule.id, quantity: null, rate: pensionRule.employeeRate,
          baseAmount: pensionableIncome,
          grossAmount: 0, taxableAmount: 0, nonTaxableAmount: 0, pensionableAmount: 0,
          deductionAmount: employeePension, employerAmount: 0,
          calculationOrder: 70, calculationNote: 'Employee portion',
        })
        lines.push({
          componentCode: 'EMPLOYER_PENSION', componentName: 'Employer Pension',
          lineType: 'EMPLOYER_PENSION', sourceType: 'STATUTORY_RULE' as never,
          sourceId: pensionRule.id, quantity: null, rate: pensionRule.employerRate,
          baseAmount: pensionableIncome,
          grossAmount: 0, taxableAmount: 0, nonTaxableAmount: 0, pensionableAmount: 0,
          deductionAmount: 0, employerAmount: employerPension,
          calculationOrder: 75, calculationNote: 'Employer portion',
        })
      }

      if (bracket && payeTax > 0) {
        lines.push({
          componentCode: 'PAYE_TAX', componentName: 'PAYE Tax',
          lineType: 'PAYE_TAX', sourceType: 'STATUTORY_RULE' as never,
          sourceId: bracket.id, quantity: null, rate: bracket.taxRate,
          baseAmount: taxableIncome,
          grossAmount: 0, taxableAmount: 0, nonTaxableAmount: 0, pensionableAmount: 0,
          deductionAmount: payeTax, employerAmount: 0,
          calculationOrder: 80, calculationNote: `Bracket: ${bracket.minIncome} - ${bracket.maxIncome ?? 'above'}`,
        })
      }

      const result: CalculationResult = {
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
        lines: [],
        blockers,
        warnings,
      }

      if (blockers.length > 0) allBlocked = true
      results.push(result)
      for (const l of lines) allLines.push({ ...l, employeeId: emp.id })
    }

    if (allBlocked) {
      await createAuditLog({
        userId: session.userId, action: 'PAYROLL_CALCULATION_BLOCKED',
        entityType: 'PayrollPeriod', entityId: id,
        newValue: { blockedCount: results.filter(r => r.blockers.length > 0).length },
      })
      return success({ blocked: true, results })
    }

    const now = new Date()
    let grossTotal = 0, taxTotal = 0, empPensionTotal = 0
    let emprPensionTotal = 0, payeTotal = 0, netTotal = 0, employerCostTotal = 0

    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.payrollPreparationBatch.create({
        data: {
          payrollPeriodId: id,
          version: 1,
          batchName: `${period.periodName} - Calculation v1`,
          payrollPeriodStart: period.periodStart,
          payrollPeriodEnd: period.periodEnd,
          calculationStatus: 'COMPLETED',
          status: 'DRAFT',
          calculationStartedAt: now,
          calculationCompletedAt: now,
          calculatedById: session.userId,
          employeeCount: results.length,
          createdById: session.userId,
        },
      })

      for (const r of results) {
        const emp = selectedEmployees.find(pe => pe.employeeId === r.employeeId)?.employee
        const row = await tx.payrollPreparationRow.create({
          data: {
            batchId: b.id,
            payrollPeriodId: id,
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
            calculationVersion: 1,
            calculatedAt: now,
            calculatedById: session.userId,
          },
        })

        const empLines = allLines.filter(l => l.employeeId === r.employeeId)
        for (const l of empLines) {
          await tx.payrollCalculationLine.create({
            data: {
              batchId: b.id,
              rowId: row.id,
              payrollPeriodId: id,
              employeeId: r.employeeId,
              componentCode: l.componentCode,
              componentName: l.componentName,
              lineType: l.lineType as never,
              sourceType: l.sourceType as never,
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

        grossTotal = round2(grossTotal + r.grossSalary)
        taxTotal = round2(taxTotal + r.taxableIncome)
        empPensionTotal = round2(empPensionTotal + r.employeePension)
        emprPensionTotal = round2(emprPensionTotal + r.employerPension)
        payeTotal = round2(payeTotal + r.payeTax)
        netTotal = round2(netTotal + r.netSalary)
        employerCostTotal = round2(employerCostTotal + r.employerTotalCost)
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
          blockerCount: results.filter(r => r.blockers.length > 0).length,
          warningCount: results.filter(r => r.warnings.length > 0).length,
        },
      })

      await tx.payrollPeriod.update({
        where: { id },
        data: { status: 'READY_FOR_REVIEW' },
      })

      return b
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_COMPLETE',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: {
        batchId: batch.id, version: 1, employeeCount: results.length,
        grossTotal, taxTotal, netTotal, employerCostTotal,
        oldStatus: 'READY_FOR_CALCULATION', newStatus: 'READY_FOR_REVIEW',
      },
    })

    return success({
      batchId: batch.id,
      version: 1,
      employeeCount: results.length,
      grossEarningsTotal: grossTotal,
      taxableIncomeTotal: taxTotal,
      employeePensionTotal: empPensionTotal,
      employerPensionTotal: emprPensionTotal,
      payeTaxTotal: payeTotal,
      netSalaryTotal: netTotal,
      employerTotalCost: employerCostTotal,
    })
  } catch (e) { console.error(e); return internalError() }
}
