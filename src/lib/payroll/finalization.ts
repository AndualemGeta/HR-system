import { prisma } from '@/lib/prisma'
import { roundMoney, sumMoney, money } from '@/lib/money'
import crypto from 'crypto'

export interface FinalizationResult {
  success: boolean
  outputPackageId?: string
  blockers: string[]
  warnings: string[]
  totals?: {
    employeeCount: number
    grossTotal: number
    deductionTotal: number
    netPayTotal: number
    employeePensionTotal: number
    employerPensionTotal: number
    payeTaxTotal: number
    employerCostTotal: number
  }
}

function hashJson(data: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

export async function finalizePayroll(
  payrollPeriodId: string,
  userId: string,
): Promise<FinalizationResult> {
  const blockers: string[] = []
  const warnings: string[] = []

  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } })
  if (!period) {
    blockers.push('PAYROLL_PERIOD_NOT_FOUND')
    return { success: false, blockers, warnings }
  }
  if (period.status !== 'APPROVED') {
    blockers.push('PAYROLL_PERIOD_NOT_APPROVED')
    return { success: false, blockers, warnings }
  }

  const batch = await prisma.payrollPreparationBatch.findFirst({
    where: { payrollPeriodId, status: 'APPROVED' },
    orderBy: { version: 'desc' },
  })
  if (!batch) {
    blockers.push('PAYROLL_BATCH_NOT_APPROVED')
    return { success: false, blockers, warnings }
  }
  if (batch.blockerCount && batch.blockerCount > 0) {
    blockers.push('PAYROLL_BATCH_HAS_BLOCKERS')
    return { success: false, blockers, warnings }
  }

  const existing = await prisma.payrollOutputPackage.findFirst({
    where: { payrollPreparationBatchId: batch.id },
  })
  if (existing) {
    blockers.push('PAYROLL_OUTPUT_ALREADY_EXISTS')
    return { success: false, blockers, warnings }
  }

  const rows = await prisma.payrollPreparationRow.findMany({
    where: { batchId: batch.id },
    include: {
      calculationLines: true,
      employee: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          currentRole: true,
          currentDepartmentId: true,
          currentRegionId: true,
          currentAreaId: true,
          currentShopId: true,
          employmentType: true,
          currentLevel: true,
          currentDivisionId: true,
        },
      },
    },
  })

  if (rows.length === 0) {
    blockers.push('NO_EMPLOYEES_IN_BATCH')
    return { success: false, blockers, warnings }
  }

  // Calculate totals from rows
  let grossTotal = 0, deductionTotal = 0, netPayTotal = 0
  let employeePensionTotal = 0, employerPensionTotal = 0, payeTaxTotal = 0
  let employerCostTotal = 0

  const payslipSnapshots: Array<{
    rowId: string
    employeeId: string
    employeeCode: string
    fullName: string
    snapshot: Record<string, unknown>
    grossSalary: number
    totalDeductions: number
    netSalary: number
  }> = []

  for (const row of rows) {
    const r = row as typeof row & {
      grossSalary: unknown; taxableIncome: unknown; employeePension: unknown
      employerPension: unknown; payeTax: unknown; totalDeductions: unknown
      netSalary: unknown; employerTotalCost: unknown
    }

    const gs = Number(r.grossSalary) || 0
    const td = Number(r.totalDeductions) || 0
    const ns = Number(r.netSalary) || 0
    const ep = Number(r.employeePension) || 0
    const erp = Number(r.employerPension) || 0
    const pt = Number(r.payeTax) || 0
    const ec = Number(r.employerTotalCost) || 0

    grossTotal = roundMoney(money(grossTotal).plus(gs))
    deductionTotal = roundMoney(money(deductionTotal).plus(td))
    netPayTotal = roundMoney(money(netPayTotal).plus(ns))
    employeePensionTotal = roundMoney(money(employeePensionTotal).plus(ep))
    employerPensionTotal = roundMoney(money(employerPensionTotal).plus(erp))
    payeTaxTotal = roundMoney(money(payeTaxTotal).plus(pt))
    employerCostTotal = roundMoney(money(employerCostTotal).plus(ec))

    // Reconcile row-level: gross from lines should match row grossSalary
    const lineGrossTotal = roundMoney(sumMoney(...row.calculationLines.map(l => Number(l.grossAmount))))
    if (lineGrossTotal !== gs) {
      blockers.push(`PAYROLL_BATCH_RECONCILIATION_FAILED:Row ${row.employeeCode} gross mismatch ${lineGrossTotal} vs ${gs}`)
    }

    // Build snapshot for payslip
    const snapshot: Record<string, unknown> = {
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      role: row.role,
      department: row.department,
      region: row.region,
      area: row.employee?.currentAreaId || null,
      shop: row.shop,
      employmentType: row.employmentType,
      level: row.level,
      division: row.division,
      basicSalary: Number(row.basicSalary) || 0,
      proratedBasicSalary: Number(row.proratedBasicSalary) || 0,
      grossSalary: gs,
      taxableIncome: Number(row.taxableIncome) || 0,
      employeePension: ep,
      employerPension: erp,
      payeTax: pt,
      totalDeductions: td,
      netSalary: ns,
      employerTotalCost: ec,
      preTaxDeductions: Number(row.preTaxDeductions) || 0,
      postTaxDeductions: Number(row.postTaxDeductions) || 0,
      lines: row.calculationLines.map(l => ({
        componentCode: l.componentCode,
        componentName: l.componentName,
        lineType: l.lineType,
        grossAmount: Number(l.grossAmount),
        taxableAmount: Number(l.taxableAmount),
        deductionAmount: Number(l.deductionAmount),
        employerAmount: Number(l.employerAmount),
        calculationOrder: l.calculationOrder,
      })),
    }

    payslipSnapshots.push({
      rowId: row.id,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      snapshot,
      grossSalary: gs,
      totalDeductions: td,
      netSalary: ns,
    })
  }

  // Reconcile batch-level totals against batch record
  const batchGrossTotal = Number(batch.grossEarningsTotal) || 0
  if (Math.abs(grossTotal - batchGrossTotal) > 0.01) {
    blockers.push(`PAYROLL_BATCH_RECONCILIATION_FAILED:Batch gross mismatch computed=${grossTotal} vs stored=${batchGrossTotal}`)
  }

  if (blockers.length > 0) {
    return { success: false, blockers, warnings }
  }

  // All monetary fields for snapshot hash
  const snapshotData = {
    batchId: batch.id,
    version: batch.version,
    periodStart: batch.payrollPeriodStart,
    periodEnd: batch.payrollPeriodEnd,
    grossTotal,
    deductionTotal,
    netPayTotal,
    employeePensionTotal,
    employerPensionTotal,
    payeTaxTotal,
    employerCostTotal,
    employeeCount: rows.length,
    employeeIds: rows.map(r => r.employeeId).sort(),
  }
  const snapshotHash = hashJson(snapshotData)

  // Create output package and snapsnots in a transaction
  const pkg = await prisma.$transaction(async (tx) => {
    const outputPackage = await tx.payrollOutputPackage.create({
      data: {
        payrollPeriodId,
        payrollPreparationBatchId: batch.id,
        batchVersion: batch.version,
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedById: userId,
        employeeCount: rows.length,
        grossTotal,
        deductionTotal,
        netPayTotal,
        employerCostTotal,
        employeePensionTotal,
        employerPensionTotal,
        payeTaxTotal,
        snapshotHash,
      },
    })

    for (const ps of payslipSnapshots) {
      const docHash = hashJson(ps.snapshot)
      await tx.payslipSnapshot.create({
        data: {
          outputPackageId: outputPackage.id,
          payrollPeriodId,
          payrollPreparationBatchId: batch.id,
          payrollPreparationRowId: ps.rowId,
          employeeId: ps.employeeId,
          employeeCode: ps.employeeCode,
          fullName: ps.fullName,
          snapshotJson: JSON.stringify(ps.snapshot),
          grossSalary: ps.grossSalary,
          totalDeductions: ps.totalDeductions,
          netSalary: ps.netSalary,
          documentHash: docHash,
          version: 1,
        },
      })
    }

    return outputPackage
  })

  return {
    success: true,
    outputPackageId: pkg.id,
    blockers: [],
    warnings,
    totals: {
      employeeCount: rows.length,
      grossTotal,
      deductionTotal,
      netPayTotal,
      employeePensionTotal,
      employerPensionTotal,
      payeTaxTotal,
      employerCostTotal,
    },
  }
}

export async function approveOutputPackage(
  outputPackageId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id: outputPackageId } })
  if (!pkg) return { success: false, error: 'Output package not found' }
  if (pkg.status !== 'REVIEWED') return { success: false, error: `Cannot approve package with status ${pkg.status}` }
  if (pkg.finalizedById === userId) return { success: false, error: 'Finalizer cannot approve own output package' }

  await prisma.payrollOutputPackage.update({
    where: { id: outputPackageId },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
  })
  return { success: true }
}

export async function reviewOutputPackage(
  outputPackageId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id: outputPackageId } })
  if (!pkg) return { success: false, error: 'Output package not found' }
  if (pkg.status !== 'FINALIZED') return { success: false, error: `Cannot review package with status ${pkg.status}` }

  await prisma.payrollOutputPackage.update({
    where: { id: outputPackageId },
    data: { status: 'REVIEWED', reviewedAt: new Date(), reviewedById: userId },
  })
  return { success: true }
}

export async function cancelOutputPackage(
  outputPackageId: string,
  userId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id: outputPackageId } })
  if (!pkg) return { success: false, error: 'Output package not found' }
  if (pkg.status === 'APPROVED' || pkg.status === 'CANCELLED') {
    return { success: false, error: `Cannot cancel package with status ${pkg.status}` }
  }

  await prisma.payrollOutputPackage.update({
    where: { id: outputPackageId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, cancellationReason: reason },
  })
  return { success: true }
}
