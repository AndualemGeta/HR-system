import { prisma } from '../lib/prisma'
import { computePensionEligible, computePayroll } from '../lib/payroll/mvp-calculations'
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'

let passed = 0
let failed = 0
let totalTests = 0
const errors: string[] = []

async function assert(label: string, fn: () => Promise<boolean | void>) {
  totalTests++
  try {
    const ok = await fn()
    if (ok !== false) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; errors.push(label); console.log(`  \u2717 ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  \u2717 ${label} \u2014 ${e instanceof Error ? e.message : String(e)}`)
  }
}

const testSuffix = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const hrEmail = `hr_${testSuffix}@test.com`
const financeEmail = `finance_${testSuffix}@test.com`

const emp1Code = `EMP_${testSuffix}_1`
const emp2Code = `EMP_${testSuffix}_2`
const emp3Code = `EMP_${testSuffix}_3`

let hrUserId = ''
let financeUserId = ''
let hrToken = ''
let financeToken = ''
let emp1Id = ''
let emp2Id = ''
let emp3Id = ''
let periodId = ''
let testRowId = ''
let exportId = ''
let exportFileName = ''

const PAYROLL_SHEETS = [
  'HO,A.A SHOP', 'DSA', 'EBU Department', 'Aleletu', 'Chacha',
  'Legetafo', 'Hmariam', 'Sirti', 'Mendida', 'Sendafa', 'Sheno',
  'Performance Summary', 'Overtime',
]

async function createUser(email: string, name: string, roleName: string): Promise<string> {
  const password = 'Test123!'
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, name, passwordHash: hash, isActive: true },
  })
  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (role) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } })
  }
  return user.id
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status} ${res.statusText}`)
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header')
  const match = setCookie.match(/session=([^;]+)/)
  if (!match) throw new Error('No session cookie')
  return match[1]
}

async function api(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Cookie'] = `session=${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, data: json.data, error: json.error }
}

async function main() {
  console.log('\n=== MVP Payroll Isolated E2E Suite ===\n')

  // Health check
  try {
    await fetch(`${BASE}/api/auth/me`, { method: 'GET' })
    console.log('  \u2713 Server reachable')
  } catch {
    console.log('  \u2717 Cannot reach server — start with "npm run dev" first')
    process.exit(1)
  }

  // 1. Create isolated users
  console.log('\n[Create Isolated Users]')
  hrUserId = await createUser(hrEmail, 'HR Test User', 'HR Manager')
  financeUserId = await createUser(financeEmail, 'Finance Test User', 'Finance Manager')
  console.log(`  \u2713 Created HR user: ${hrEmail} (${hrUserId})`)
  console.log(`  \u2713 Created Finance user: ${financeEmail} (${financeUserId})`)

  // 4. Login through real API
  console.log('\n[Login]')
  await assert('HR user login succeeds', async () => {
    hrToken = await login(hrEmail, 'Test123!')
    return !!hrToken
  })
  await assert('Finance user login succeeds', async () => {
    financeToken = await login(financeEmail, 'Test123!')
    return !!financeToken
  })

  // 2-3. Create employee fixtures with unique codes and emails
  console.log('\n[Create Employee Fixtures]')
  await assert('Create employee 1 (ACTIVE, old hire date, HO_AA_SHOP)', async () => {
    const emp = await prisma.employee.create({
      data: {
        employeeId: emp1Code,
        firstName: 'Alice',
        lastName: 'Test',
        fullName: `Alice Test ${testSuffix}`,
        email: `alice_${testSuffix}@test.com`,
        employmentStatus: 'ACTIVE',
        hireDate: new Date('2025-01-15'),
        basicSalary: 10000,
        currentRole: 'ACCOUNTANT',
        employeeCategory: 'HEAD_OFFICE',
      },
    })
    emp1Id = emp.id

    await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id,
        payrollGroup: 'HO_AA_SHOP',
        paymentMethod: 'BANK',
        bankName: 'Test Bank',
        bankAccountNumber: '1234567890',
        taxId: 'TAX001',
        pensionId: 'PEN001',
      },
    })
    return !!emp.id
  })

  await assert('Create employee 2 (ACTIVE, second month, DSA)', async () => {
    const emp = await prisma.employee.create({
      data: {
        employeeId: emp2Code,
        firstName: 'Bob',
        lastName: 'Test',
        fullName: `Bob Test ${testSuffix}`,
        email: `bob_${testSuffix}@test.com`,
        employmentStatus: 'ACTIVE',
        hireDate: new Date('2026-06-15'),
        basicSalary: 8000,
        currentRole: 'DSA',
        employeeCategory: 'SHOP_FIELD',
      },
    })
    emp2Id = emp.id

    await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id,
        payrollGroup: 'DSA',
        paymentMethod: 'MPESA',
        mpesaAccount: '251911111111',
        taxId: 'TAX002',
      },
    })
    return !!emp.id
  })

  await assert('Create employee 3 (ACTIVE, this month hire, EBU_DEPARTMENT)', async () => {
    const now = new Date()
    const hireThisMonth = new Date(now.getFullYear(), now.getMonth(), 15)
    const emp = await prisma.employee.create({
      data: {
        employeeId: emp3Code,
        firstName: 'Charlie',
        lastName: 'Test',
        fullName: `Charlie Test ${testSuffix}`,
        email: `charlie_${testSuffix}@test.com`,
        employmentStatus: 'ACTIVE',
        hireDate: hireThisMonth,
        basicSalary: 6000,
        currentRole: 'EBU_SUPERVISOR',
        employeeCategory: 'SHOP_FIELD',
      },
    })
    emp3Id = emp.id

    await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id,
        payrollGroup: 'EBU_DEPARTMENT',
        paymentMethod: 'CASH',
        taxId: 'TAX003',
      },
    })
    return !!emp.id
  })

  // 5. Create unique payroll period
  console.log('\n[Create Payroll Period]')
  const now = new Date()
  const testYear = now.getFullYear()
  const testMonth = now.getMonth() + 1

  await assert('POST /api/payroll creates unique period', async () => {
    const res = await api('POST', '/api/payroll', { month: testMonth, year: testYear }, hrToken)
    if (res.status === 400 && res.error?.includes('already exists')) {
      // Try a unique future period
      const uniqueMonth = testMonth === 12 ? 1 : testMonth + 1
      const uniqueYear = testMonth === 12 ? testYear + 1 : testYear
      const res2 = await api('POST', '/api/payroll', { month: uniqueMonth, year: uniqueYear }, hrToken)
      periodId = res2.data?.id || ''
      return res2.status === 201 && !!periodId
    }
    periodId = res.data?.id || ''
    return res.status === 201 && !!periodId
  })

  if (!periodId) {
    console.log('  \u2717 Cannot continue without payroll period')
    throw new Error('No payroll period created')
  }

  // 6. Snapshot only the controlled fixtures
  console.log('\n[Snapshot]')
  await assert('POST /api/payroll/:id/snapshot snapshots controlled employees', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/snapshot`, { confirm: false }, hrToken)
    return res.status === 200 && (res.data?.employeeCount || 0) >= 3
  })

  // Verify all three test employees are in the rows
  await assert('All three test employees snapshotted', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: periodId, employeeCode: { in: [emp1Code, emp2Code, emp3Code] } },
    })
    return rows.length === 3
  })

  // 7. Edit working days
  console.log('\n[Edit Working Days]')
  await assert('PUT /api/payroll/:id/rows updates workingDays', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({
      where: { payrollPeriodId: periodId, employeeCode: emp1Code },
    })
    if (!row) return false
    testRowId = row.id
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: testRowId, workingDays: 25 }] }, hrToken)
    if (res.status !== 200) return false
    const updated = await prisma.mvpPayrollRow.findUnique({ where: { id: testRowId } })
    return Number(updated?.workingDays) === 25
  })

  // 8. Edit commission and overtime separately
  await assert('Edit commission for Alice', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({
      where: { payrollPeriodId: periodId, employeeCode: emp1Code },
    })
    if (!row) return false
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: row.id, commission: 500 }] }, hrToken)
    if (res.status !== 200) return false
    const updated = await prisma.mvpPayrollRow.findUnique({ where: { id: row.id } })
    return Number(updated?.commission) === 500
  })

  await assert('Edit overtime for Alice', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({
      where: { payrollPeriodId: periodId, employeeCode: emp1Code },
    })
    if (!row) return false
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: row.id, overtime: 300 }] }, hrToken)
    if (res.status !== 200) return false
    const updated = await prisma.mvpPayrollRow.findUnique({ where: { id: row.id } })
    return Number(updated?.overtime) === 300
  })

  // 9. Calculate
  console.log('\n[Calculate]')
  await assert('POST /api/payroll/:id/calculate persists formulas', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/calculate`, undefined, hrToken)
    return res.status === 200
  })

  // 10. Verify persisted formulas via shared module
  console.log('\n[Verify Persisted Formulas]')
  await assert('Alice monthly salary = 10000/30 * 25', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row || !row.monthlySalary) return false
    const expected = Math.round((10000 / 30) * 25 * 100) / 100
    return Math.abs(Number(row.monthlySalary) - expected) <= 1
  })

  await assert('Alice gross = monthly + 500 + 300', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row || !row.grossSalary || !row.monthlySalary) return false
    const expected = Number(row.monthlySalary) + 500 + 300
    return Math.abs(Number(row.grossSalary) - expected) <= 1
  })

  await assert('Alice income tax computed correctly', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row || !row.incomeTax || !row.grossSalary) return false
    const expected = computePayroll({
      basicSalary: 10000, workingDays: 25, commission: 500, overtime: 300,
      incentive: 0, allowance: 0, otherDeduction: 0, pensionEligible: true,
    })
    return Math.abs(Number(row.incomeTax) - expected.incomeTax) <= 1
  })

  // 11. First-month pension is zero (Charlie, hired this month)
  await assert('Charlie (hire this month) pension = 0', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp3Code } })
    if (!row) return false
    return Number(row.employeePension) === 0
  })

  // 12. Second-month pension is zero (Bob, hired last month)
  await assert('Bob (second month) pension = 0', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp2Code } })
    if (!row) return false
    return Number(row.employeePension) === 0
  })

  // 13. Third-month+ pension is 7% and 11% (Alice, hired Jan 2025)
  await assert('Alice (old hire) employee pension = 7% of basic', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row) return false
    return Math.abs(Number(row.employeePension) - 700) <= 1
  })

  await assert('Alice (old hire) employer pension = 11% of basic', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row) return false
    return Math.abs(Number(row.employerPension) - 1100) <= 1
  })

  // 14. Validate
  console.log('\n[Validate]')
  await assert('POST /api/payroll/:id/validate runs successfully', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)
    return res.status === 200
  })

  // 15. Prove READY rejects PENDING rows
  console.log('\n[READY Gate — PENDING Rejection]')
  await assert('Edit a row to reset to PENDING', async () => {
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: testRowId, notes: 'trigger pending' }] }, hrToken)
    return res.status === 200
  })

  await assert('READY is rejected when rows are PENDING', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
    return res.status === 400 && res.error?.includes('PENDING')
  })

  // Re-validate
  await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)

  // 16. Prove READY rejects ERROR rows
  console.log('\n[READY Gate — ERROR Rejection]')
  await assert('READY is rejected when rows have ERROR', async () => {
    // Set Charlie's rows to have a zero basic salary to trigger error
    const charlieRow = await prisma.mvpPayrollRow.findFirst({
      where: { payrollPeriodId: periodId, employeeCode: emp3Code },
    })
    if (charlieRow) {
      await prisma.mvpPayrollRow.update({
        where: { id: charlieRow.id },
        data: { validationStatus: 'ERROR', validationMessages: JSON.stringify(['Intentional test error']) },
      })
    }
    const res = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
    return res.status === 400 && res.error?.includes('ERROR')
  })

  // Fix and re-validate
  await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)

  // 17. Mark READY after all blockers resolved
  console.log('\n[Mark READY]')
  await assert('POST /api/payroll/:id/ready succeeds when no blockers', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
    if (res.status !== 200) {
      console.log(`  (ready blocked: ${res.error})`)
      // Re-validate and retry
      await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)
      const retry = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
      if (retry.status !== 200) {
        console.log(`  (still blocked: ${retry.error})`)
      }
      return retry.status === 200
    }
    return true
  })

  const readyPeriod = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
  await assert('Period status is READY', async () => {
    return readyPeriod?.status === 'READY'
  })

  // 18. Generate Excel and require HTTP 200
  console.log('\n[Generate Excel]')
  await assert('POST /api/payroll/:id/generate-excel returns 200', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/generate-excel`, undefined, hrToken)
    if (res.status === 400) {
      console.log(`  (export blocked: ${res.error})`)
    }
    if (res.status === 200 && res.data?.export) {
      exportId = res.data.export.id
      exportFileName = res.data.export.fileName
    }
    return res.status === 200
  })

  // 19. Open generated file and verify
  console.log('\n[Verify Generated Excel]')
  await assert('Export record created with row count', async () => {
    const exp = await prisma.mvpPayrollExport.findUnique({ where: { id: exportId } })
    return !!exp && exp.rowCount >= 3
  })

  await assert('Download export via API succeeds', async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (hrToken) headers['Cookie'] = `session=${hrToken}`
    const res = await fetch(`${BASE}/api/payroll/${periodId}/download-excel?exportId=${exportId}`, { headers })
    return res.status === 200
  })

  // 20. Lock the period
  console.log('\n[Lock]')
  await assert('POST /api/payroll/:id/lock transitions to LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/lock`, undefined, hrToken)
    if (res.status !== 200) {
      console.log(`  (lock blocked: ${res.error})`)
      return false
    }
    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'LOCKED'
  })

  // 21. Prove locked rows cannot be edited
  console.log('\n[Locked - Immutable Rows]')
  await assert('PUT rows is rejected when LOCKED', async () => {
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: testRowId, workingDays: 28 }] }, hrToken)
    return res.status === 400 && res.error?.includes('LOCKED')
  })

  await assert('Calculate is rejected when LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/calculate`, undefined, hrToken)
    return res.status === 400 && res.error?.includes('LOCKED')
  })

  await assert('Re-snapshot is rejected when LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/snapshot`, { confirm: true }, hrToken)
    return res.status === 400 && res.error?.includes('LOCKED')
  })

  await assert('Export remains available when LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/generate-excel`, undefined, hrToken)
    return res.status === 200
  })

  // 22. Reopen with a reason
  console.log('\n[Reopen]')
  await assert('Reopen requires reason', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/reopen`, {}, hrToken)
    return res.status === 400
  })

  await assert('POST /api/payroll/:id/reopen with reason transitions to DRAFT', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/reopen`, { reason: 'E2E test correction needed' }, hrToken)
    if (res.status !== 200) return false
    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'DRAFT' && period?.reopenReason === 'E2E test correction needed'
  })

  await assert('Row validation reset to PENDING after reopen', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: periodId },
      select: { validationStatus: true },
    })
    return rows.length > 0 && rows.every(r => r.validationStatus === 'PENDING')
  })

  // 23. Prove historical export records remain
  console.log('\n[Historical Exports]')
  await assert('Export records still exist after reopen', async () => {
    const exports = await prisma.mvpPayrollExport.findMany({
      where: { payrollPeriodId: periodId },
    })
    return exports.length >= 1
  })

  // 24. Cleanup only test-created data
  console.log('\n[Cleanup]')
  try {
    if (periodId) {
      await prisma.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: periodId } })
      await prisma.mvpPayrollExport.deleteMany({ where: { payrollPeriodId: periodId } })
      await prisma.mvpPayrollPeriod.delete({ where: { id: periodId } })
    }
    if (emp1Id) await prisma.employeePayrollProfile.deleteMany({ where: { employeeId: emp1Id } })
    if (emp2Id) await prisma.employeePayrollProfile.deleteMany({ where: { employeeId: emp2Id } })
    if (emp3Id) await prisma.employeePayrollProfile.deleteMany({ where: { employeeId: emp3Id } })
    if (emp1Id) await prisma.employee.delete({ where: { id: emp1Id } })
    if (emp2Id) await prisma.employee.delete({ where: { id: emp2Id } })
    if (emp3Id) await prisma.employee.delete({ where: { id: emp3Id } })
    if (hrUserId) {
      await prisma.userRole.deleteMany({ where: { userId: hrUserId } })
      await prisma.user.delete({ where: { id: hrUserId } })
    }
    if (financeUserId) {
      await prisma.userRole.deleteMany({ where: { userId: financeUserId } })
      await prisma.user.delete({ where: { id: financeUserId } })
    }
    console.log('  \u2713 Cleaned up all test-created data')
  } catch (e) {
    console.log('  \u2717 Cleanup error (non-fatal):', e instanceof Error ? e.message : e)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`MVP Payroll Isolated E2E: ${totalTests} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(60)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
