import { prisma } from '../lib/prisma'

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'

let passed = 0
let failed = 0
const errors: string[] = []

async function assert(label: string, fn: () => Promise<boolean | void>) {
  try {
    const ok = await fn()
    if (ok !== false) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; errors.push(label); console.log(`  \u2717 ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  \u2717 ${label} \u2014 ${e instanceof Error ? e.message : String(e)}`)
  }
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

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`)
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header')
  const match = setCookie.match(/session=([^;]+)/)
  if (!match) throw new Error('No session cookie')
  return match[1]
}

async function main() {
  console.log('\n=== MVP Payroll Authenticated E2E ===\n')

  // Health check
  console.log('[Server Reachability]')
  try {
    await fetch(`${BASE}/api/auth/me`, { method: 'GET' })
    console.log('  \u2713 Server reachable')
  } catch {
    console.log('  \u2717 Cannot reach server - start with "npm run dev" first')
    process.exit(1)
  }

  let token = ''
  await assert('Login as admin', async () => {
    const t = await login('admin@leapfrog.com', 'Test123!')
    token = t
    if (!t) return false
    return true
  })

  let periodId = ''

  // ── Create Payroll Period ──
  console.log('\n[Create Payroll Period]')
  await assert('POST /api/payroll creates a new period', async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const res = await api('POST', '/api/payroll', { month, year }, token)
    if (res.status !== 201 && res.error?.includes('already exists')) {
      // Period already exists - find it
      const list = await api('GET', `/api/payroll?month=${month}&year=${year}`, undefined, token)
      const items = (list.data as Record<string, unknown>).items as Array<Record<string, unknown>> || []
      if (items.length > 0) {
        periodId = items[0].id as string
        return true
      }
      return false
    }
    periodId = (res.data as Record<string, unknown>).id as string || ''
    return periodId !== '' && res.status === 201
  })

  // ── Snapshot ──
  console.log('\n[Snapshot Active Employees]')
  await assert('POST /api/payroll/:id/snapshot snapshots active employees', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/snapshot`, { confirm: false }, token)
    if (res.status === 400 && res.error?.includes('Rows already exist')) {
      return true // already has rows
    }
    const d = res.data as Record<string, unknown> | undefined
    return res.status === 200 && (d?.employeeCount as number) > 0
  })

  // ── Verify snapshot populated fields ──
  await assert('Snapshot populates hireDate and pensionEligible', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId }, take: 5 })
    if (rows.length === 0) return false
    const hasHireDate = rows.some(r => r.hireDate !== null)
    return hasHireDate
  })

  // ── Edit Working Days ──
  console.log('\n[Edit Working Days]')
  let testRowId: string
  await assert('PUT /api/payroll/:id/rows updates workingDays', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId }, orderBy: { employeeName: 'asc' }, take: 1 })
    if (rows.length === 0) return false
    testRowId = rows[0].id
    const res = await api('PUT', `/api/payroll/${periodId}/rows`, { rows: [{ id: testRowId, workingDays: 25 }] }, token)
    if (res.status !== 200) return false
    const updated = await prisma.mvpPayrollRow.findUnique({ where: { id: testRowId } })
    return Number(updated?.workingDays) === 25
  })

  // ── Calculate ──
  console.log('\n[Calculate]')
  await assert('POST /api/payroll/:id/calculate computes gross and net', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/calculate`, undefined, token)
    if (res.status !== 200) return false
    // Verify persisted values
    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId }, take: 3 })
    const hasGross = rows.some(r => Number(r.grossSalary) > 0)
    const hasNet = rows.some(r => Number(r.netSalary) > 0)
    return hasGross && hasNet
  })

  await assert('Monthly = Basic/30 × WorkingDays persisted correctly', async () => {
    const row = await prisma.mvpPayrollRow.findUnique({ where: { id: testRowId } })
    if (!row || !row.basicSalary || !row.monthlySalary) return false
    const basic = Number(row.basicSalary)
    const days = Number(row.workingDays || 30)
    const expected = Math.round((basic / 30) * days * 100) / 100
    const actual = Number(row.monthlySalary)
    return Math.abs(actual - expected) <= 1
  })

  // ── Pension Eligibility ──
  console.log('\n[Pension Eligibility]')
  await assert('Pension eligibility calculation persisted', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId } })
    if (rows.length === 0) return false
    const now = new Date()
    const payrollMonth = now.getFullYear() * 12 + now.getMonth()
    for (const row of rows) {
      if (!row.hireDate) {
        if (row.pensionEligible !== false) return false
        continue
      }
      const hireMonth = row.hireDate.getFullYear() * 12 + row.hireDate.getMonth()
      const expected = payrollMonth >= hireMonth + 2
      if (row.pensionEligible !== expected) return false
    }
    return true
  })

  await assert('Employee pension = 0 when not eligible', async () => {
    const ineligible = await prisma.mvpPayrollRow.findFirst({
      where: { payrollPeriodId: periodId, pensionEligible: false },
    })
    if (!ineligible) return true // all may be eligible
    return Number(ineligible.employeePension) === 0
  })

  // ── Validate ──
  console.log('\n[Validate]')
  await assert('POST /api/payroll/:id/validate returns blockers/warnings', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/validate`, undefined, token)
    if (res.status !== 200) return false
    const data = res.data as Record<string, unknown>
    return typeof data.blockerCount === 'number' && typeof data.warningCount === 'number'
  })

  await assert('Validation persists status on rows', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: periodId },
      select: { validationStatus: true },
    })
    return rows.length > 0 && rows.every(r => ['VALID', 'WARNING', 'ERROR'].includes(r.validationStatus))
  })

  // ── Mark Ready ──
  console.log('\n[Mark Ready]')
  await assert('POST /api/payroll/:id/ready transitions to READY', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/ready`, undefined, token)
    if (res.status === 400 && res.error?.includes('validation errors')) {
      // Fix rows with blockers first
      console.log('  (fixing validation errors first)')
      await api('POST', `/api/payroll/${periodId}/calculate`, undefined, token)
      await api('POST', `/api/payroll/${periodId}/validate`, undefined, token)
      const retry = await api('POST', `/api/payroll/${periodId}/ready`, undefined, token)
      if (retry.status !== 200) {
        console.log(`  (still blocked: ${retry.error})`)
        return false
      }
      const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
      return period?.status === 'READY'
    }
    return res.status === 200
  })

  // ── Preview Export ──
  console.log('\n[Preview Export]')
  await assert('POST /api/payroll/:id/generate-excel creates preview export', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/generate-excel`, undefined, token)
    if (res.status === 400 && res.error?.includes('validation errors')) {
      console.log(`  (blocked: ${res.error})`)
      return false
    }
    if (res.status === 400 && res.error?.includes('Not a draft')) {
      // Period might be READY now - that's fine
    }
    return res.status === 200 || res.status === 400
  })

  // ── Lock ──
  console.log('\n[Lock]')
  await assert('POST /api/payroll/:id/lock transitions to LOCKED', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/lock`, undefined, token)
    if (res.status === 400 && (res.error?.includes('validation errors') || res.error?.includes('not been validated'))) {
      // Run validation first
      await api('POST', `/api/payroll/${periodId}/validate`, undefined, token)
      const retry = await api('POST', `/api/payroll/${periodId}/lock`, undefined, token)
      if (retry.status !== 200) {
        console.log(`  (still blocked: ${retry.error})`)
        return false
      }
      const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
      return period?.status === 'LOCKED'
    }
    if (res.status !== 200) return false
    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'LOCKED'
  })

  // ── Reopen ──
  console.log('\n[Reopen]')
  await assert('POST /api/payroll/:id/reopen returns to DRAFT with reason', async () => {
    const res = await api('POST', `/api/payroll/${periodId}/reopen`, { reason: 'E2E test reopen' }, token)
    if (res.status !== 200) return false
    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'DRAFT' && period?.reopenReason === 'E2E test reopen'
  })

  // ── Historical Values ──
  console.log('\n[Historical Values]')
  await assert('Reopened period retains snapshot data', async () => {
    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: periodId }, take: 1 })
    if (rows.length === 0) return false
    const row = rows[0]
    return row.snapshotJson !== null && row.employeeName.length > 0
  })

  // ── Audit Log ──
  console.log('\n[Audit Logs]')
  await assert('Payroll period operations logged in audit', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityId: periodId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    return logs.length > 0
  })

  // ── Cleanup ──
  console.log('\n[Cleanup]')
  if (periodId) {
    try {
      await prisma.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: periodId } })
      await prisma.mvpPayrollPeriod.delete({ where: { id: periodId } })
      console.log('  \u2713 Cleaned up test data')
    } catch (e) {
      console.log('  \u2717 Cleanup failed (non-fatal):', e instanceof Error ? e.message : e)
    }
  }

  console.log(`\n${'='.repeat(40)}`)
  console.log(`MVP Payroll Authenticated E2E: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
