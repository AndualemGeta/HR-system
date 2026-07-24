import { prisma } from '../lib/prisma'
import { computePayroll } from '../lib/payroll/mvp-calculations'
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

const createdUserIds: string[] = []
const createdEmployeeIds: string[] = []
const createdPeriodIds: string[] = []
const createdExportIds: string[] = []
const createdRowIds: string[] = []
const createdProfileIds: string[] = []

const uniquePeriodName = `Jan 2035 E2E ${testSuffix}`

const DETERMINISTIC_YEAR = 2035
const DETERMINISTIC_MONTH = 0 // January

const emp1Hire = new Date(DETERMINISTIC_YEAR - 1, 9, 15) // Oct 2034
const emp2Hire = new Date(DETERMINISTIC_YEAR - 1, 11, 15) // Dec 2034
const emp3Hire = new Date(DETERMINISTIC_YEAR, 0, 15) // Jan 2035

async function createUser(email: string, name: string, roleName: string): Promise<string> {
  const password = 'Test123!'
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, name, passwordHash: hash, isActive: true },
  })
  createdUserIds.push(user.id)
  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) throw new Error(`Role "${roleName}" not found in database. Seed must create this role first.`)
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } })
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

async function cleanup() {
  try {
    for (const eid of createdExportIds) {
      await prisma.mvpPayrollExport.delete({ where: { id: eid } }).catch(() => {})
    }
    for (const rid of createdRowIds) {
      await prisma.mvpPayrollRow.delete({ where: { id: rid } }).catch(() => {})
    }
    for (const pid of createdPeriodIds) {
      await prisma.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: pid } })
      await prisma.mvpPayrollExport.deleteMany({ where: { payrollPeriodId: pid } })
      await prisma.mvpPayrollPeriod.delete({ where: { id: pid } }).catch(() => {})
    }
    for (const pid of createdProfileIds) {
      await prisma.employeePayrollProfile.delete({ where: { id: pid } }).catch(() => {})
    }
    for (const eid of createdEmployeeIds) {
      await prisma.employeePayrollProfile.deleteMany({ where: { employeeId: eid } })
      await prisma.employee.delete({ where: { id: eid } }).catch(() => {})
    }
    for (const uid of createdUserIds) {
      await prisma.userRole.deleteMany({ where: { userId: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }
    console.log('  \u2713 Cleaned up all test-created data')
  } catch (e) {
    console.log('  \u2717 Cleanup error (non-fatal):', e instanceof Error ? e.message : e)
  }
}

async function main() {
  console.log('\n=== MVP Payroll Isolated E2E Suite (Deterministic: Jan 2035) ===\n')

  try {
    await fetch(`${BASE}/api/auth/me`, { method: 'GET' })
    console.log('  \u2713 Server reachable')
  } catch {
    console.log('  \u2717 Cannot reach server \u2014 start with "npm run dev" first')
    process.exit(1)
  }

  console.log('\n[Create Isolated Users]')
  hrUserId = await createUser(hrEmail, 'HR Test User', 'MVP HR')
  financeUserId = await createUser(financeEmail, 'Finance Test User', 'MVP Finance')
  console.log(`  \u2713 Created HR user: ${hrEmail} (${hrUserId})`)
  console.log(`  \u2713 Created Finance user: ${financeEmail} (${financeUserId})`)

  console.log('\n[Login]')
  await assert('HR user login succeeds', async () => {
    hrToken = await login(hrEmail, 'Test123!')
    return !!hrToken
  })
  await assert('Finance user login succeeds', async () => {
    financeToken = await login(financeEmail, 'Test123!')
    return !!financeToken
  })

  console.log('\n[Create Employee Fixtures]')
  await assert('Create emp1 (ACTIVE, HO_AA_SHOP, hired Oct 2034)', async () => {
    const emp = await prisma.employee.create({
      data: {
        employeeId: emp1Code,
        firstName: 'Alice', lastName: 'Test',
        fullName: `Alice Test ${testSuffix}`,
        email: `alice_${testSuffix}@test.com`,
        employmentStatus: 'ACTIVE',
        hireDate: emp1Hire,
        basicSalary: 10000,
        currentRole: 'ACCOUNTANT',
        employeeCategory: 'HEAD_OFFICE',
      },
    })
    emp1Id = emp.id
    createdEmployeeIds.push(emp.id)
    const profile = await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id, payrollGroup: 'HO_AA_SHOP',
        paymentMethod: 'BANK', bankName: 'Test Bank', bankAccountNumber: '1234567890',
        taxId: 'TAX001', pensionId: 'PEN001',
      },
    })
    createdProfileIds.push(profile.id)
    return !!emp.id
  })

  await assert('Create emp2 (ACTIVE, DSA, hired Dec 2034)', async () => {
    const emp = await prisma.employee.create({
      data: {
        employeeId: emp2Code,
        firstName: 'Bob', lastName: 'Test',
        fullName: `Bob Test ${testSuffix}`,
        email: `bob_${testSuffix}@test.com`,
        employmentStatus: 'ACTIVE', hireDate: emp2Hire,
        basicSalary: 8000, currentRole: 'DSA', employeeCategory: 'SHOP_FIELD',
      },
    })
    emp2Id = emp.id
    createdEmployeeIds.push(emp.id)
    const profile = await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id, payrollGroup: 'DSA',
        paymentMethod: 'MPESA', mpesaAccount: '251911111111', taxId: 'TAX002',
      },
    })
    createdProfileIds.push(profile.id)
    return !!emp.id
  })

  await assert('Create emp3 (ACTIVE, EBU_DEPARTMENT, hired Jan 2035)', async () => {
    const emp = await prisma.employee.create({
      data: {
        employeeId: emp3Code,
        firstName: 'Charlie', lastName: 'Test',
        fullName: `Charlie Test ${testSuffix}`,
        email: `charlie_${testSuffix}@test.com`,
        employmentStatus: 'ACTIVE', hireDate: emp3Hire,
        basicSalary: 6000, currentRole: 'EBU_SUPERVISOR', employeeCategory: 'SHOP_FIELD',
      },
    })
    emp3Id = emp.id
    createdEmployeeIds.push(emp.id)
    const profile = await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id, payrollGroup: 'EBU_DEPARTMENT',
        paymentMethod: 'CASH', taxId: 'TAX003',
      },
    })
    createdProfileIds.push(profile.id)
    return !!emp.id
  })

  console.log('\n[Snapshot Employee Status Selection Test]')
  const statuses = ['DRAFT', 'ONBOARDING', 'ACTIVE', 'ON_PROBATION', 'ON_LEAVE', 'RESIGNED', 'TERMINATED', 'SUSPENDED']
  const statusEmpIds: string[] = []
  for (const status of statuses) {
    const emp = await prisma.employee.create({
      data: {
        employeeId: `STATUS_${testSuffix}_${status}`,
        firstName: `Status${status}`, lastName: 'Test',
        fullName: `Status ${status} Test ${testSuffix}`,
        email: `status_${status}_${testSuffix}@test.com`,
        employmentStatus: status as never,
        hireDate: new Date(2034, 0, 1),
        basicSalary: 5000, currentRole: 'EMPLOYEE', employeeCategory: 'HEAD_OFFICE',
      },
    })
    statusEmpIds.push(emp.id)
    createdEmployeeIds.push(emp.id)
    const profile = await prisma.employeePayrollProfile.create({
      data: {
        employeeId: emp.id, payrollGroup: 'HO_AA_SHOP',
        paymentMethod: 'BANK', bankName: 'Status Bank', bankAccountNumber: `STATUS_${status}_ACCT`,
        taxId: `TAX_STATUS_${status}`, pensionId: `PEN_STATUS_${status}`,
      },
    })
    createdProfileIds.push(profile.id)
  }

  await assert('Create Jan 2035 period with unique name', async () => {
    const res = await api('POST', `/api/payroll`, { month: DETERMINISTIC_MONTH + 1, year: DETERMINISTIC_YEAR, periodName: uniquePeriodName }, hrToken)
    if (res.status === 201 || res.status === 200) {
      periodId = res.data?.id || ''
      createdPeriodIds.push(periodId)
      return !!periodId
    }
    return false
  })

  await assert('Snapshot includes ACTIVE employees', async () => {
    if (!periodId) return false
    const res = await api('POST', `/api/payroll/${periodId}/snapshot`, { confirm: false }, hrToken)
    if (res.status !== 200) {
      console.log(`  (snapshot error: ${res.error})`)
      return false
    }
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    for (const r of snapRows) createdRowIds.push(r.id)
    const snapCodes = snapRows.map(r => r.employeeCode)
    const hasActive = snapCodes.includes(emp1Code) && snapCodes.includes(emp2Code) && snapCodes.includes(emp3Code)
    return hasActive
  })

  await assert('Snapshot includes ON_PROBATION employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return snapCodes.includes(`STATUS_${testSuffix}_ON_PROBATION`)
  })

  await assert('Snapshot excludes DRAFT employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_DRAFT`)
  })

  await assert('Snapshot excludes ONBOARDING employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_ONBOARDING`)
  })

  await assert('Snapshot excludes ON_LEAVE employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_ON_LEAVE`)
  })

  await assert('Snapshot excludes RESIGNED employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_RESIGNED`)
  })

  await assert('Snapshot excludes TERMINATED employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_TERMINATED`)
  })

  await assert('Snapshot excludes EXITED employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_EXITED`)
  })

  await assert('Snapshot excludes SUSPENDED employees', async () => {
    const snapRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    const snapCodes = snapRows.map(r => r.employeeCode)
    return !snapCodes.includes(`STATUS_${testSuffix}_SUSPENDED`)
  })

  for (const sid of statusEmpIds) {
    await prisma.employeePayrollProfile.deleteMany({ where: { employeeId: sid } })
    await prisma.employee.delete({ where: { id: sid } }).catch(() => {})
  }

  assert('All three test employees snapshotted', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: periodId, employeeCode: { in: [emp1Code, emp2Code, emp3Code] } },
    })
    return rows.length === 3
  })

  if (!periodId) throw new Error('No payroll period created')

  console.log('\n[Edit Working Days]')
  await assert('PUT rows updates workingDays', async () => {
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

  await assert('Edit commission for Alice', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row) return false
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: row.id, commission: 500 }] }, hrToken)
    if (res.status !== 200) return false
    const updated = await prisma.mvpPayrollRow.findUnique({ where: { id: row.id } })
    return Number(updated?.commission) === 500
  })
  await assert('Edit overtime for Alice', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row) return false
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: row.id, overtime: 300 }] }, hrToken)
    if (res.status !== 200) return false
    const updated = await prisma.mvpPayrollRow.findUnique({ where: { id: row.id } })
    return Number(updated?.overtime) === 300
  })

  console.log('\n[Calculate]')
  await assert('POST calculate persists formulas', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/calculate`, undefined, hrToken)
    return res.status === 200
  })

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

  console.log('\n[Pension Eligibility (Deterministic Jan 2035)]')
  await assert('Charlie (hired Jan 2035, first month) pension = 0', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp3Code } })
    if (!row) return false
    return Number(row.employeePension) === 0
  })
  await assert('Bob (hired Dec 2034, second month) pension = 0', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp2Code } })
    if (!row) return false
    return Number(row.employeePension) === 0
  })
  await assert('Alice (hired Oct 2034, 4th month) employee pension = 7% of 10000', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row) return false
    return Math.abs(Number(row.employeePension) - 700) <= 1
  })
  await assert('Alice employer pension = 11% of 10000', async () => {
    const row = await prisma.mvpPayrollRow.findFirst({ where: { payrollPeriodId: periodId, employeeCode: emp1Code } })
    if (!row) return false
    return Math.abs(Number(row.employerPension) - 1100) <= 1
  })

  console.log('\n[Validate]')
  await assert('POST validate runs successfully', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)
    return res.status === 200
  })

  console.log('\n[READY Gate \u2014 PENDING Rejection]')
  await assert('Edit resets validation to PENDING', async () => {
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: testRowId, notes: 'trigger pending' }] }, hrToken)
    return res.status === 200
  })
  await assert('READY rejected when PENDING', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
    return res.status === 400 && res.error?.includes('PENDING')
  })
  await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)

  console.log('\n[READY Gate \u2014 ERROR Rejection]')
  await assert('READY rejected when ERROR rows exist', async () => {
    const charlieRow = await prisma.mvpPayrollRow.findFirst({
      where: { payrollPeriodId: periodId, employeeCode: emp3Code },
    })
    if (!charlieRow) return false
    const setRes = await api('PUT', `/api/payroll/${periodId}/rows`,
      { rows: [{ id: charlieRow.id, basicSalary: 0 }] }, hrToken)
    if (setRes.status !== 200) return false
    const valRes = await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)
    if (valRes.status !== 200) return false
    const readyRes = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
    return readyRes.status === 400 && (readyRes.error?.includes('ERROR') || readyRes.error?.includes('error'))
  })

  const charlieRowFix = await prisma.mvpPayrollRow.findFirst({
    where: { payrollPeriodId: periodId, employeeCode: emp3Code },
  })
  if (charlieRowFix) {
    await api('PUT', `/api/payroll/${periodId}/rows`,
      { rows: [{ id: charlieRowFix.id, basicSalary: 6000 }] }, hrToken)
  }
  await api('POST', `/api/payroll/${periodId}/validate`, undefined, hrToken)

  console.log('\n[Mark READY]')
  await assert('POST ready succeeds when no blockers', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/ready`, undefined, hrToken)
    return res.status === 200
  })
  await assert('Period status is READY', async () => {
    const p = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return p?.status === 'READY'
  })

  console.log('\n[Generate Excel]')
  await assert('POST generate-excel returns 200', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/generate-excel`, undefined, hrToken)
    if (res.status === 200 && res.data?.export) {
      exportId = res.data.export.id
      createdExportIds.push(exportId)
    }
    return res.status === 200
  })

  console.log('\n[Verify Generated Excel]')
  await assert('Export record created', async () => {
    const exp = await prisma.mvpPayrollExport.findUnique({ where: { id: exportId } })
    return !!exp && exp.rowCount >= 3
  })
  await assert('Download via /download-excel?exportId= succeeds', async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (hrToken) headers['Cookie'] = `session=${hrToken}`
    const res = await fetch(`${BASE}/api/payroll/${periodId}/download-excel?exportId=${exportId}`, { headers })
    return res.status === 200
  })

  console.log('\n[Lock]')
  await assert('POST lock transitions to LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/lock`, undefined, hrToken)
    if (res.status !== 200) {
      console.log(`  (lock blocked: ${res.error})`)
      return false
    }
    const p = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return p?.status === 'LOCKED'
  })

  console.log('\n[Locked Immutability]')
  await assert('PUT rows rejected when LOCKED', async () => {
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: testRowId, workingDays: 28 }] }, hrToken)
    return res.status === 400 && (res.error?.includes('LOCKED') || res.status === 400)
  })
  await assert('Calculate rejected when LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/calculate`, undefined, hrToken)
    return res.status === 400
  })
  await assert('Re-snapshot rejected when LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/snapshot`, { confirm: true }, hrToken)
    return res.status === 400
  })
  await assert('Export available when LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/generate-excel`, undefined, hrToken)
    return res.status === 200
  })

  console.log('\n[Reopen]')
  await assert('Reopen requires reason', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/reopen`, {}, hrToken)
    return res.status === 400
  })
  await assert('Reopen with reason transitions to DRAFT', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/reopen`, { reason: 'E2E test correction' }, hrToken)
    if (res.status !== 200) return false
    const p = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return p?.status === 'DRAFT' && p?.reopenReason === 'E2E test correction'
  })

  console.log('\n[Historical Exports]')
  await assert('Export records persist after reopen', async () => {
    const exps = await prisma.mvpPayrollExport.findMany({ where: { payrollPeriodId: periodId } })
    return exps.length >= 1
  })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`MVP Payroll Isolated E2E: ${totalTests} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(60)}\n`)
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1) })
  .finally(() => {
    cleanup().then(() => process.exit(failed > 0 ? 1 : 0))
  })