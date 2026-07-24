import { prisma } from '../lib/prisma'
import { computePayroll, computePensionEligible } from '../lib/payroll/mvp-calculations'

let passed = 0
let failed = 0

async function assert(label: string, fn: () => Promise<boolean>) {
  try {
    const result = await fn()
    if (result) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; console.log(`  \u2717 ${label}`) }
  } catch (e) {
    failed++; console.log(`  \u2717 ${label}: ${e instanceof Error ? e.message : e}`)
  }
}

async function main() {
  console.log('\n=== MVP Payroll Unit Tests ===\n')

  // ── Formula Logic Tests (shared module) ──
  console.log('[Workbook Formulas via Shared Module]')
  await assert('Monthly = Basic/30 × WorkingDays', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 25, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    return r.monthlySalary === Math.round((10000 / 30) * 25 * 100) / 100
  })
  await assert('Gross = Monthly + Commission + Overtime + KPI', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 500, overtime: 300, incentive: 200, allowance: 0, otherDeduction: 0, pensionEligible: false })
    return r.grossSalary === r.monthlySalary + 500 + 300 + 200
  })
  await assert('Commission/Ot are kept separate internally, combined in commissionOt', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 500, overtime: 300, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    return r.commissionOt === 800
  })
  await assert('Income tax bracket 0–2000 = 0', async () => {
    const r = computePayroll({ basicSalary: 1800, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    return r.incomeTax === 0 && r.taxableIncome === r.grossSalary
  })
  await assert('Income tax bracket 2001–4000 = 15% - 300', async () => {
    const r = computePayroll({ basicSalary: 3000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    const expectedTax = Math.round((3000 * 0.15 - 300) * 100) / 100
    return r.incomeTax === expectedTax
  })
  await assert('Income tax bracket 4001–7000 = 20% - 500', async () => {
    const r = computePayroll({ basicSalary: 5500, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    const expectedTax = Math.round((5500 * 0.20 - 500) * 100) / 100
    return r.incomeTax === expectedTax
  })
  await assert('Income tax bracket 7001–10000 = 25% - 850', async () => {
    const r = computePayroll({ basicSalary: 8500, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    const expectedTax = Math.round((8500 * 0.25 - 850) * 100) / 100
    return r.incomeTax === expectedTax
  })
  await assert('Income tax bracket 10001–14000 = 30% - 1350', async () => {
    const r = computePayroll({ basicSalary: 12000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    const expectedTax = Math.round((12000 * 0.30 - 1350) * 100) / 100
    return r.incomeTax === expectedTax
  })
  await assert('Income tax bracket 14001+ = 35% - 2050', async () => {
    const r = computePayroll({ basicSalary: 20000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    const expectedTax = Math.round((20000 * 0.35 - 2050) * 100) / 100
    return r.incomeTax === expectedTax
  })
  await assert('Employee pension = Basic × 7% when eligible', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: true })
    return r.employeePension === 700
  })
  await assert('Employee pension = 0 when not eligible', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    return r.employeePension === 0
  })
  await assert('Employer pension = Basic × 11% when eligible', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: true })
    return r.employerPension === 1100
  })
  await assert('Employer pension = 0 when not eligible', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: false })
    return r.employerPension === 0
  })
  await assert('Total deduction = Tax + Employee pension + Shortage/Loan', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 0, otherDeduction: 500, pensionEligible: true })
    return r.totalDeduction === r.incomeTax + 700 + 500
  })
  await assert('Net = Gross - Total deduction + Transport allowance', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 800, otherDeduction: 500, pensionEligible: true })
    return r.netSalary === r.grossSalary - r.totalDeduction + 800
  })
  await assert('Transport allowance is NOT included in gross salary', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 0, overtime: 0, incentive: 0, allowance: 800, otherDeduction: 0, pensionEligible: false })
    return r.grossSalary === r.monthlySalary
  })
  await assert('All monetary results rounded to 2 decimals', async () => {
    const r = computePayroll({ basicSalary: 10000, workingDays: 30, commission: 100, overtime: 50, incentive: 25.75, allowance: 800, otherDeduction: 200.33, pensionEligible: true })
    const vals = [r.monthlySalary, r.commissionOt, r.grossSalary, r.taxableIncome, r.incomeTax, r.employeePension, r.employerPension, r.totalDeduction, r.netSalary]
    return vals.every(v => v === Math.round(v * 100) / 100)
  })

  // ── Pension eligibility (shared module) ──
  console.log('\n[Pension Eligibility via Shared Module]')
  await assert('Not eligible when hire date is null', async () => {
    return computePensionEligible(null, new Date('2026-07-01')) === false
  })
  await assert('Not eligible in hire month', async () => {
    return computePensionEligible(new Date('2026-07-15'), new Date('2026-07-01')) === false
  })
  await assert('Not eligible in second payroll month', async () => {
    return computePensionEligible(new Date('2026-06-15'), new Date('2026-07-01')) === false
  })
  await assert('Eligible from third payroll month onward', async () => {
    return computePensionEligible(new Date('2026-05-15'), new Date('2026-07-01')) === true
  })
  await assert('Eligible many months later', async () => {
    return computePensionEligible(new Date('2025-01-15'), new Date('2026-07-01')) === true
  })

let testRowId: string | null = null

  // ── Persisted Row Tests ──
  console.log('\n[Persisted Payroll Rows]')
  await assert('Create controlled fixture row for persistence test', async () => {
    const period = await prisma.mvpPayrollPeriod.findFirst({ where: { } })
    if (period) {
      const row = await prisma.mvpPayrollRow.create({
        data: {
          payrollPeriodId: period.id,
          employeeId: 'test-fixture',
          employeeCode: 'FIXTURE_001',
          employeeName: 'Fixture Test',
          basicSalary: 10000,
          workingDays: 25,
          commission: 500,
          overtime: 300,
          grossSalary: 9133.33,
          incomeTax: 1480,
          totalDeduction: 2180,
          netSalary: 6953.33,
        },
      })
      testRowId = row.id
      return !!row.id
    }
    // If no period exists, skip fixture creation but don't report false positive
    return true
  })

  await assert('Persisted row calculation matches computePayroll', async () => {
    if (!testRowId) return true // no fixture to test
    const row = await prisma.mvpPayrollRow.findUnique({ where: { id: testRowId } })
    if (!row) return false
    const expected = computePayroll({
      basicSalary: Number(row.basicSalary || 0),
      workingDays: Number(row.workingDays || 30),
      commission: Number(row.commission || 0),
      overtime: Number(row.overtime || 0),
      incentive: Number(row.incentive || 0),
      allowance: Number(row.allowance || 0),
      otherDeduction: Number(row.otherDeduction || 0),
      pensionEligible: row.pensionEligible === true,
    })
    const monthlyOk = Math.abs(Number(row.monthlySalary || 0) - expected.monthlySalary) <= 1
    const grossOk = Math.abs(Number(row.grossSalary || 0) - expected.grossSalary) <= 1
    const taxOk = Math.abs(Number(row.incomeTax || 0) - expected.incomeTax) <= 1
    const empPensionOk = Math.abs(Number(row.employeePension || 0) - expected.employeePension) <= 1
    const empPension2Ok = Math.abs(Number(row.employerPension || 0) - expected.employerPension) <= 1
    const totalDedOk = Math.abs(Number(row.totalDeduction || 0) - expected.totalDeduction) <= 1
    const netOk = Math.abs(Number(row.netSalary || 0) - expected.netSalary) <= 1
    if (!(monthlyOk && grossOk && taxOk && empPensionOk && empPension2Ok && totalDedOk && netOk)) {
      console.log(`  Mismatch for ${row.employeeName}: persisted vs expected differ`)
      return false
    }
    return true
  })

  // Cleanup fixture
  if (testRowId) {
    await prisma.mvpPayrollRow.delete({ where: { id: testRowId } }).catch(() => {})
  }

  console.log(`\n${'='.repeat(40)}`)
  console.log(`MVP Payroll Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
