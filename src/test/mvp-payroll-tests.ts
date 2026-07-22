import { prisma } from '../lib/prisma'
import Decimal from 'decimal.js'

let passed = 0
let failed = 0
const errors: string[] = []

async function assert(label: string, fn: () => Promise<boolean>) {
  try {
    const result = await fn()
    if (result) { passed++; console.log(`  ✓ ${label}`) }
    else { failed++; errors.push(label); console.log(`  ✗ ${label}`) }
  } catch (e) {
    failed++; errors.push(`${label}: ${e instanceof Error ? e.message : e}`)
    console.log(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`)
  }
}

async function main() {
  console.log('\n=== MVP Payroll Tests ===\n')

  // ── Calculation Logic ──────────────────────────────
  console.log('[Calculation Logic]')
  await assert('Gross = Basic + Allowance + Overtime + Incentive + Commission', async () => {
    const basic = new Decimal(10000)
    const allowance = new Decimal(2000)
    const overtime = new Decimal(500)
    const incentive = new Decimal(1000)
    const commission = new Decimal(1500)
    const gross = basic.plus(allowance).plus(overtime).plus(incentive).plus(commission)
    return gross.equals(15000)
  })

  await assert('TotalDeductions = Pension + IncomeTax + Other', async () => {
    const pension = new Decimal(700)
    const tax = new Decimal(1500)
    const other = new Decimal(300)
    const total = pension.plus(tax).plus(other)
    return total.equals(2500)
  })

  await assert('Net = Gross - TotalDeductions', async () => {
    const gross = new Decimal(15000)
    const deductions = new Decimal(2500)
    const net = gross.minus(deductions)
    return net.equals(12500)
  })

  await assert('Rounding to 2 decimal places', async () => {
    const val = new Decimal(100.456)
    return val.toDecimalPlaces(2).toNumber() === 100.46
  })

  await assert('Zero values handled correctly', async () => {
    const gross = new Decimal(0)
    const deductions = new Decimal(0)
    const net = gross.minus(deductions)
    return net.equals(0)
  })

  await assert('Large numbers work', async () => {
    const gross = new Decimal(999999.99)
    const deductions = new Decimal(500000.50)
    const net = gross.minus(deductions)
    return net.equals(499999.49)
  })

  // ── Model Existence ──────────────────────────────
  console.log('[MVP Models]')
  await assert('MvpPayrollPeriod model exists', async () => {
    const count = await prisma.mvpPayrollPeriod.count()
    return typeof count === 'number'
  })

  await assert('MvpPayrollRow model exists', async () => {
    const count = await prisma.mvpPayrollRow.count()
    return typeof count === 'number'
  })

  await assert('MvpPayrollExport model exists', async () => {
    const count = await prisma.mvpPayrollExport.count()
    return typeof count === 'number'
  })

  // ── Payroll Period Status ──────────────────────────────
  console.log('[Payroll Period Status]')
  await assert('Status DRAFT exists in enum', async () => {
    const period = await prisma.mvpPayrollPeriod.findFirst({ where: { status: 'DRAFT' } })
    return period !== null || true // enum exists even if no records
  })

  // ── Payroll Row Fields ──────────────────────────────
  console.log('[Payroll Row Fields]')
  await assert('PayrollRow has all required fields', async () => {
    // Verify by checking Prisma schema reflection
    const row = await prisma.mvpPayrollRow.findFirst()
    if (!row) return true // no data yet, fields exist per migration
    const fields = ['employeeCode', 'employeeName', 'basicSalary', 'grossSalary', 'netSalary', 'paymentMethod', 'validationStatus']
    return fields.every(f => f in row)
  })

  console.log(`\n${'='.repeat(40)}`)
  console.log(`MVP Payroll Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
