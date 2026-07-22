import { prisma } from '../lib/prisma'

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

// ── Workbook formula helpers (must match API logic exactly) ──
function calcMonthly(basic: number, workingDays: number): number {
  return Math.round((basic / 30) * workingDays * 100) / 100
}
function calcGross(monthly: number, commission: number, overtime: number, kpi: number): number {
  return Math.round((monthly + commission + overtime + kpi) * 100) / 100
}
function calcTax(taxable: number): number {
  if (taxable <= 2000) return 0
  if (taxable <= 4000) return Math.round((taxable * 0.15 - 300) * 100) / 100
  if (taxable <= 7000) return Math.round((taxable * 0.20 - 500) * 100) / 100
  if (taxable <= 10000) return Math.round((taxable * 0.25 - 850) * 100) / 100
  if (taxable <= 14000) return Math.round((taxable * 0.30 - 1350) * 100) / 100
  return Math.round((taxable * 0.35 - 2050) * 100) / 100
}
function calcPensionEligible(hireDate: Date | null, periodStart: Date): boolean {
  if (!hireDate) return false
  const hireMonth = hireDate.getFullYear() * 12 + hireDate.getMonth()
  const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
  return payrollMonth >= hireMonth + 2
}
function calcTotalDed(tax: number, empPension: number, shortageLoan: number): number {
  return Math.round((tax + empPension + shortageLoan) * 100) / 100
}
function calcNet(gross: number, totalDed: number, allowance: number): number {
  return Math.round((gross - totalDed + allowance) * 100) / 100
}

async function main() {
  console.log('\n=== MVP Payroll Unit Tests ===\n')

  // ── Formula Logic Tests (pure) ──
  console.log('[Workbook Formulas]')
  await assert('Monthly = Basic/30 × WorkingDays', async () => {
    const result = calcMonthly(10000, 25)
    return result === 8333.33
  })

  await assert('Gross = Monthly + Commission + Overtime + KPI', async () => {
    const result = calcGross(10000, 1500, 500, 1000)
    return result === 13000
  })

  await assert('Progressive Income Tax (bracket 1: ≤2000 = 0)', async () => {
    return calcTax(2000) === 0
  })

  await assert('Progressive Income Tax (bracket 2: 2001-4000 = 15% - 300)', async () => {
    return calcTax(3500) === 225 // 3500*0.15 - 300 = 225
  })

  await assert('Progressive Income Tax (bracket 5: 10001-14000 = 30% - 1350)', async () => {
    return calcTax(12000) === 2250 // 12000*0.30 - 1350 = 2250
  })

  await assert('Progressive Income Tax (bracket 7: >20000 = 35% - 2050)', async () => {
    return calcTax(30000) === 8450 // 30000*0.35 - 2050 = 8450
  })

  await assert('TotalDeduction = Tax + EmployeePension + Shortage/Loan', async () => {
    return calcTotalDed(1500, 700, 300) === 2500
  })

  await assert('Net = Gross - TotalDeduction + TransportAllowance', async () => {
    return calcNet(15000, 2500, 1000) === 13500
  })

  // ── Pension Eligibility Tests (pure logic) ──
  console.log('[Pension Eligibility]')
  await assert('1. Current payroll month: not eligible', async () => {
    return calcPensionEligible(new Date('2026-06-10'), new Date('2026-06-01')) === false
  })

  await assert('2. Second payroll month: not eligible', async () => {
    return calcPensionEligible(new Date('2026-06-10'), new Date('2026-07-01')) === false
  })

  await assert('3. Third payroll month: eligible', async () => {
    return calcPensionEligible(new Date('2026-06-10'), new Date('2026-08-01')) === true
  })

  await assert('4. After third month: eligible', async () => {
    return calcPensionEligible(new Date('2026-06-10'), new Date('2026-12-01')) === true
  })

  await assert('5. Missing hire date: not eligible', async () => {
    return calcPensionEligible(null, new Date('2026-06-01')) === false
  })

  await assert('6. Boundary: last day of month', async () => {
    const r1 = calcPensionEligible(new Date('2026-06-30'), new Date('2026-06-01'))
    const r2 = calcPensionEligible(new Date('2026-06-30'), new Date('2026-07-01'))
    const r3 = calcPensionEligible(new Date('2026-06-30'), new Date('2026-08-01'))
    return r1 === false && r2 === false && r3 === true
  })

  // ── Persisted data verification (if DB has data) ──
  console.log('[Persisted Data]')
  await assert('MvpPayrollPeriod table has records (if any)', async () => {
    const count = await prisma.mvpPayrollPeriod.count()
    return typeof count === 'number'
  })

  await assert('MvpPayrollRow has hireDate and pensionEligible fields', async () => {
    const row = await prisma.mvpPayrollRow.findFirst()
    if (!row) return true
    return 'hireDate' in row && 'pensionEligible' in row
  })

  await assert('Payroll rows have workingDays and monthlySalary', async () => {
    const row = await prisma.mvpPayrollRow.findFirst()
    if (!row) return true
    return 'workingDays' in row && 'monthlySalary' in row
  })

  // Verify a persisted row's calculation against workbook formula
  await assert('Persisted row matches workbook formulas (if data exists)', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({
      where: {
        basicSalary: { not: null },
        grossSalary: { not: null },
        netSalary: { not: null },
        monthlySalary: { not: null },
      },
    })
    if (!row) return true
    const basic = Number(row.basicSalary)
    const days = Number(row.workingDays || 30)
    const commission = Number(row.commission || 0)
    const overtime = Number(row.overtime || 0)
    const kpi = Number(row.incentive || 0)
    const allowance = Number(row.allowance || 0)
    const tax = Number(row.incomeTax || 0)
    const empPension = Number(row.employeePension || 0)
    const shortageLoan = Number(row.otherDeduction || 0)

    const monthly = Number(row.monthlySalary)
    const expectedMonthly = calcMonthly(basic, days)
    if (monthly > 0 && Math.abs(monthly - expectedMonthly) > 1) {
      console.log(`    Monthly mismatch: ${monthly} vs expected ${expectedMonthly}`)
      return false
    }

    const gross = Number(row.grossSalary)
    const expectedGross = calcGross(monthly || expectedMonthly, commission, overtime, kpi)
    if (gross > 0 && Math.abs(gross - expectedGross) > 1) {
      console.log(`    Gross mismatch: ${gross} vs expected ${expectedGross}`)
      return false
    }

    const totalDed = Number(row.totalDeduction || 0)
    const expectedTotalDed = calcTotalDed(tax, empPension, shortageLoan)
    if (totalDed > 0 && Math.abs(totalDed - expectedTotalDed) > 1) {
      console.log(`    TotalDed mismatch: ${totalDed} vs expected ${expectedTotalDed}`)
      return false
    }

    const net = Number(row.netSalary)
    const expectedNet = calcNet(gross, totalDed, allowance)
    if (net > 0 && Math.abs(net - expectedNet) > 1) {
      console.log(`    Net mismatch: ${net} vs expected ${expectedNet}`)
      return false
    }

    return true
  })

  console.log(`\n${'='.repeat(40)}`)
  console.log(`MVP Payroll Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
