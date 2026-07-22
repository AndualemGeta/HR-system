import { prisma } from '@/lib/prisma'
import { roundMoney, money } from '@/lib/money'
import type { CalculationContext, CalculationResult } from './types'

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
            lineType: l.lineType,
            sourceType: l.sourceType,
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

      const inputIds = r.lines
        .filter(l => l.sourceType === 'PAYROLL_INPUT' && l.sourceId)
        .map(l => l.sourceId!)
      if (inputIds.length > 0) {
        await tx.payrollInput.updateMany({
          where: { id: { in: inputIds }, payrollPeriodId: ctx.payrollPeriodId },
          data: { isLocked: true, lockedAt: now, lockedById: userId, lockReason: `Batch ${b.id} v${version}` },
        })
      }

      grossTotal = roundMoney(money(grossTotal).plus(r.grossSalary))
      taxTotal = roundMoney(money(taxTotal).plus(r.taxableIncome))
      empPensionTotal = roundMoney(money(empPensionTotal).plus(r.employeePension))
      emprPensionTotal = roundMoney(money(emprPensionTotal).plus(r.employerPension))
      payeTotal = roundMoney(money(payeTotal).plus(r.payeTax))
      netTotal = roundMoney(money(netTotal).plus(r.netSalary))
      employerCostTotal = roundMoney(money(employerCostTotal).plus(r.employerTotalCost))
      otherDedTotal = roundMoney(money(otherDedTotal).plus(r.postTaxDeductions))
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
