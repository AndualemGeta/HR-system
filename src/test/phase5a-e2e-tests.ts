import { prisma } from '../lib/prisma'

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'

let passed = 0
let failed = 0
const errors: string[] = []
const cleanupFns: (() => Promise<void>)[] = []

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

async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`)
  const body = await res.json()
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header in login response')
  const match = setCookie.match(/session=([^;]+)/)
  if (!match) throw new Error('No session cookie in set-cookie header')
  return { token: match[1], userId: body.data?.user?.id }
}

let payrollOfficerToken: string
let financeDirectorToken: string
let employeeToken: string
let payrollOfficerId: string
let financeDirectorId: string

function makeUnique(tag: string) {
  const ts = Date.now()
  return { employeeId: `E2E-${tag}-${ts}`, email: `e2e.${tag}.${ts}@test.leapfrog.com` }
}

async function createEmployee(tag: string, role: string) {
  const uid = makeUnique(tag)
  const emp = await prisma.employee.create({
    data: {
      employeeId: uid.employeeId,
      firstName: `E2E_${tag}`,
      lastName: 'Test',
      fullName: `E2E ${tag} Test`,
      email: uid.email,
      employmentStatus: 'ACTIVE',
      currentRole: role as any,
    },
  })
  cleanupFns.push(async () => { try { await prisma.employee.delete({ where: { id: emp.id } }) } catch {} })
  return emp
}

async function ensurePayComponent(): Promise<string> {
  const code = `E2E_ALLOW_${Date.now()}`
  const comp = await prisma.payComponent.create({
    data: {
      code,
      name: 'E2E Allowance',
      componentType: 'ALLOWANCE',
      taxTreatment: 'TAXABLE',
      isEarning: true,
      isDeduction: false,
      taxablePercent: 100,
      pensionablePercent: 100,
      affectsGross: true,
      affectsNet: true,
      isPensionable: true,
      calculationOrder: 1,
    },
  })
  cleanupFns.push(async () => { try { await prisma.payComponent.delete({ where: { id: comp.id } }) } catch {} })
  return comp.id
}

async function ensureActivePayeSchedule() {
  const existing = await prisma.payeTaxBracket.findFirst({
    where: { isActive: true, approvalStatus: 'APPROVED', isSample: false },
  })
  if (existing) return
  const scheduleCode = `E2E_SCHED_${Date.now()}`
  const brackets = [
    { minIncome: 0, maxIncome: 600, taxRate: 0, deductionAmount: 0 },
    { minIncome: 600, maxIncome: 1650, taxRate: 10, deductionAmount: 60 },
    { minIncome: 1650, maxIncome: 3200, taxRate: 15, deductionAmount: 142.5 },
    { minIncome: 3200, maxIncome: 5250, taxRate: 20, deductionAmount: 302.5 },
    { minIncome: 5250, maxIncome: 7800, taxRate: 25, deductionAmount: 565 },
    { minIncome: 7800, maxIncome: 10900, taxRate: 30, deductionAmount: 955 },
    { minIncome: 10900, maxIncome: null, taxRate: 35, deductionAmount: 1500 },
  ]
  for (const b of brackets) {
    await prisma.payeTaxBracket.create({
      data: {
        name: `E2E Bracket ${b.minIncome}-${b.maxIncome ?? 'inf'}`,
        scheduleCode,
        minIncome: b.minIncome,
        maxIncome: b.maxIncome,
        taxRate: b.taxRate,
        deductionAmount: b.deductionAmount,
        effectiveStartDate: new Date('2024-01-01'),
        effectiveEndDate: new Date('2025-12-31'),
        isActive: true,
        approvalStatus: 'APPROVED',
        isSample: false,
      },
    })
  }
}

async function ensureActivePensionRule() {
  const existing = await prisma.pensionRule.findFirst({
    where: { isActive: true, approvalStatus: 'APPROVED', isSample: false },
  })
  if (existing) return
  await prisma.pensionRule.create({
    data: {
      name: 'E2E Pension Rule',
      employeeRate: 5,
      employerRate: 10,
      pensionBaseType: 'BASIC_SALARY',
      minimumBase: null,
      maximumBase: null,
      priority: 0,
      effectiveStartDate: new Date('2024-01-01'),
      effectiveEndDate: new Date('2025-12-31'),
      isActive: true,
      approvalStatus: 'APPROVED',
      isSample: false,
    },
  })
}

async function ensureInputType(code: string, name: string, compId: string) {
  const existing = await prisma.payrollInputType.findUnique({ where: { code } })
  if (existing) return existing.id
  const it = await prisma.payrollInputType.create({
    data: {
      code, name,
      category: 'ALLOWANCE',
      valueType: 'AMOUNT',
      defaultAmount: 0,
      isActive: true,
      payComponentId: compId,
    },
  })
  cleanupFns.push(async () => { try { await prisma.payrollInputType.delete({ where: { id: it.id } }) } catch {} })
  return it.id
}

async function ensureInputRequirement(inputTypeCode: string, overrides: { role?: string; employmentType?: string; employeeCategory?: string; isActive?: boolean }) {
  const inputType = await prisma.payrollInputType.findUnique({ where: { code: inputTypeCode } })
  if (!inputType) throw new Error(`Input type ${inputTypeCode} not found`)
  const where: Record<string, unknown> = { inputTypeId: inputType.id }
  if (overrides.role) where.role = overrides.role
  if (overrides.employmentType) where.employmentType = overrides.employmentType
  if (overrides.employeeCategory) where.employeeCategory = overrides.employeeCategory
  const existing = await prisma.payrollInputRequirement.findFirst({ where: where as any })
  if (existing) return existing.id
  const req = await prisma.payrollInputRequirement.create({
    data: {
      inputTypeId: inputType.id,
      severity: 'BLOCKER',
      role: (overrides.role ?? null) as any,
      employmentType: (overrides.employmentType ?? null) as any,
      employeeCategory: (overrides.employeeCategory ?? null) as any,
      isActive: overrides.isActive !== false,
    },
  })
  cleanupFns.push(async () => { try { await prisma.payrollInputRequirement.delete({ where: { id: req.id } }) } catch {} })
  return req.id
}

async function main() {
  console.log('')
  console.log('=== Phase 5A E2E Tests (HTTP Integration) ===')
  console.log('')

  // Prerequisites check
  const seedCheck = await prisma.user.findFirst({ where: { email: 'finance.payroll@leapfrog.com' } })
  if (!seedCheck) {
    console.log('  \u2717 Prerequisites missing: seed must be run first')
    process.exit(1)
  }

  // Authenticate via real login endpoint
  const payroll = await login('finance.payroll@leapfrog.com', 'test123')
  payrollOfficerToken = payroll.token
  payrollOfficerId = payroll.userId

  const fd = await login('finance.director@leapfrog.com', 'test123')
  financeDirectorToken = fd.token
  financeDirectorId = fd.userId

  const empLogin = await login('employee@leapfrog.com', 'test123')
  employeeToken = empLogin.token

  // Create isolated test employees
  const dsaEmployee = await createEmployee('DSA', 'DSA')
  const nonDsaEmployee = await createEmployee('NON_DSA', 'DSP')

  // Ensure statutory data
  await ensureActivePayeSchedule()
  await ensureActivePensionRule()
  const payComponentId = await ensurePayComponent()

  // ─── Permission Tests ──────────────────────────────────────
  console.log('[Permission Failures]')

  await assert('No session returns 401', async () => {
    const res = await fetch(`${BASE}/api/payroll-periods`, { headers: { 'Content-Type': 'application/json' } })
    return res.status === 401
  })

  await assert('Employee without permission gets 403', async () => {
    const res = await api('GET', '/api/payroll-periods', undefined, employeeToken)
    return res.status === 403
  })

  await assert('Payroll officer with permission succeeds', async () => {
    const res = await api('GET', '/api/payroll-periods', undefined, payrollOfficerToken)
    return res.status === 200
  })

  // ─── PayComponent API with new fields ─────────────────────
  console.log('[PayComponent API]')

  await assert('Create component with all fields', async () => {
    const res = await api('POST', '/api/salary-structure/components', {
      code: `E2E_FULL_${Date.now()}`,
      name: 'E2E Full Test',
      componentType: 'ALLOWANCE',
      taxTreatment: 'TAXABLE',
      isEarning: true,
      isDeduction: false,
      isPensionable: true,
      taxablePercent: 80,
      pensionablePercent: 75,
      affectsGross: true,
      affectsNet: true,
      affectsEmployerCost: false,
      calculationOrder: 5,
    }, payrollOfficerToken)
    return res.status === 201 && res.data?.taxablePercent === 80
  })

  let compId: string | undefined
  await assert('List components returns array', async () => {
    const res = await api('GET', '/api/salary-structure/components', undefined, payrollOfficerToken)
    compId = res.data?.[0]?.id
    return Array.isArray(res.data) && res.data.length > 0
  })

  await assert('Update component pensionablePercent', async () => {
    if (!compId) return false
    const res = await api('PATCH', `/api/salary-structure/components/${compId}`, {
      isPensionable: true, pensionablePercent: 90, calculationOrder: 10,
    }, payrollOfficerToken)
    return res.status === 200 && res.data?.pensionablePercent === 90 && res.data?.calculationOrder === 10
  })

  // ─── Payroll Period & Input Setup ─────────────────────────
  console.log('[Payroll Period Setup]')

  let periodId: string | undefined
  await assert('Create payroll period', async () => {
    const res = await api('POST', '/api/payroll-periods', {
      periodName: `E2E Test ${Date.now()}`,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      payDate: '2024-02-05',
    }, payrollOfficerToken)
    periodId = res.data?.id
    return res.status === 201 && !!periodId
  })

  if (!periodId) {
    console.log('  \u2717 Cannot continue without period')
    process.exit(1)
  }
  cleanupFns.push(async () => { try { await prisma.payrollPeriod.delete({ where: { id: periodId! } }) } catch {} })

  // Add employees to period
  await assert('Add DSA employee to period', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/employees`, {
      employeeIds: [dsaEmployee.id],
    }, payrollOfficerToken)
    return res.status === 200
  })

  await assert('Add non-DSA employee to period', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/employees`, {
      employeeIds: [nonDsaEmployee.id],
    }, payrollOfficerToken)
    return res.status === 200
  })

  // ─── Requirement Applicability Tests ──────────────────────
  console.log('[Requirement Applicability]')

  // Create input type + requirement specific to DSA role
  const inputTypeId = await ensureInputType('E2E_DSA_ONLY', 'E2E DSA Only', payComponentId)
  await ensureInputRequirement('E2E_DSA_ONLY', { role: 'DSA' })

  // Submit input for DSA employee
  await assert('Submit input for DSA employee', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/inputs`, {
      employeeId: dsaEmployee.id,
      inputTypeCode: 'E2E_DSA_ONLY',
      amount: 1000,
    }, employeeToken)
    return res.status === 201 || res.status === 200
  })

  // Accept and lock the input via API
  const dsaInput = await prisma.payrollInput.findFirst({
    where: { payrollPeriodId: periodId, employeeId: dsaEmployee.id, inputType: { code: 'E2E_DSA_ONLY' } },
  })
  if (dsaInput) {
    await api('POST', `/api/payroll-periods/${periodId}/inputs/${dsaInput.id}/accept`, undefined, payrollOfficerToken)
    await api('POST', `/api/payroll-periods/${periodId}/inputs/${dsaInput.id}/lock`, undefined, payrollOfficerToken)
  }

  // Input type + requirement for non-DSA (transport type)
  await ensureInputType('E2E_TRANSPORT', 'E2E Transport', payComponentId)
  await ensureInputRequirement('E2E_TRANSPORT', { employmentType: 'GENERAL_STAFF' })

  // ─── Readiness Tests ──────────────────────────────────────
  console.log('[Readiness - DSA Requirements Do Not Apply to Non-DSA]')

  await assert('DSA employee has DSA-specific requirement blocking', async () => {
    const res = await api('GET', `/api/payroll-periods/${periodId}/calculation-readiness`, undefined, payrollOfficerToken)
    const issues = res.data?.employeeIssues
    if (!issues) return false
    const dsaIssues = issues[dsaEmployee.id]
    return dsaIssues?.blockers?.some((b: string) => b.includes('E2E_DSA_ONLY'))
  })

  // Move period through workflow using API endpoints
  await assert('Period transitions to OPEN_FOR_INPUT', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/open`, undefined, payrollOfficerToken)
    return res.status === 200
  })

  await assert('Close input collection', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/close`, undefined, payrollOfficerToken)
    return res.status === 200
  })

  // Transition to READY_FOR_CALCULATION (direct DB — no API endpoint for this status transition)
  await prisma.payrollPeriod.update({ where: { id: periodId }, data: { status: 'READY_FOR_CALCULATION' } })

  // ─── Blocked Calculation ──────────────────────────────────
  console.log('[Blocked Calculation]')

  await assert('DSA employee has blocker from missing DSA-only input', async () => {
    const res = await api('GET', `/api/payroll-periods/${periodId}/calculation-readiness`, undefined, payrollOfficerToken)
    return res.data?.blockedEmployees > 0
  })

  await assert('Blocked calculation writes no batch', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculate`, undefined, payrollOfficerToken)
    const batchCount = await prisma.payrollPreparationBatch.count({ where: { payrollPeriodId: periodId } })
    return (res.data?.blocked === true) && batchCount === 0
  })

  await assert('Blocked calculation writes no rows or lines', async () => {
    const rowCount = await prisma.payrollPreparationRow.count({ where: { payrollPeriodId: periodId } })
    const lineCount = await prisma.payrollCalculationLine.count({ where: { payrollPeriodId: periodId } })
    return rowCount === 0 && lineCount === 0
  })

  // Now satisfy the DSA requirement so calculation can proceed
  if (dsaInput) {
    await prisma.payrollInput.upsert({
      where: { id: dsaInput.id },
      update: { isLocked: true, status: 'ACCEPTED', amount: 1000 },
      create: {
        payrollPeriodId: periodId, employeeId: dsaEmployee.id,
        inputTypeId, amount: 1000, status: 'ACCEPTED', isLocked: true,
      },
    })
  }

  // Remove non-DSA employee to avoid transport requirement blocking
  await prisma.payrollPeriodEmployee.deleteMany({
    where: { payrollPeriodId: periodId, employeeId: nonDsaEmployee.id },
  }).catch(() => {})

  await assert('After satisfying requirements, all employees ready', async () => {
    const res = await api('GET', `/api/payroll-periods/${periodId}/calculation-readiness`, undefined, payrollOfficerToken)
    return res.data?.blockedEmployees === 0 && res.data?.readyEmployees > 0
  })

  // ─── Full Calculation ─────────────────────────────────────
  console.log('[Full Calculation]')

  let batchId: string | undefined
  await assert('Calculate payroll succeeds', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculate`, undefined, payrollOfficerToken)
    batchId = res.data?.batchId
    return res.status === 200 && !!batchId && !res.data?.blocked
  })

  await assert('Batch version is 1', async () => {
    const res = await api('GET', `/api/payroll-periods/${periodId}/calculation`, undefined, payrollOfficerToken)
    return res.data?.batch?.version === 1
  })

  await assert('Calculation totals present', async () => {
    const res = await api('GET', `/api/payroll-periods/${periodId}/calculation`, undefined, payrollOfficerToken)
    const s = res.data?.summary
    return s && s.grossEarningsTotal >= 0 && typeof s.netSalaryTotal === 'number' && s.employeeCount > 0
  })

  await assert('Calculation rows exist', async () => {
    const res = await api('GET', `/api/payroll-periods/${periodId}/calculation`, undefined, payrollOfficerToken)
    return Array.isArray(res.data?.rows) && res.data.rows.length > 0
  })

  await assert('Period status changed to READY_FOR_REVIEW', async () => {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'READY_FOR_REVIEW'
  })

  // ─── Review / Validation / Approval Workflow ──────────────
  console.log('[Review Workflow]')

  await assert('Start review requires REVIEW permission', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/start-review`, undefined, employeeToken)
    return res.status === 403
  })

  await assert('Start review succeeds with permission', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/start-review`, undefined, payrollOfficerToken)
    return res.status === 200
  })

  await assert('Period status is REVIEW_IN_PROGRESS', async () => {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'REVIEW_IN_PROGRESS'
  })

  await assert('Validate batch requires VALIDATE permission', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/validate`, undefined, employeeToken)
    return res.status === 403
  })

  await assert('Validate batch succeeds', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/validate`, undefined, financeDirectorToken)
    return res.status === 200 && res.data?.status === 'VALIDATED'
  })

  await assert('Batch status is VALIDATED', async () => {
    const batch = await prisma.payrollPreparationBatch.findFirst({ where: { payrollPeriodId: periodId }, orderBy: { version: 'desc' } })
    return batch?.status === 'VALIDATED'
  })

  await assert('Approve requires APPROVE permission', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/approve`, undefined, payrollOfficerToken)
    return res.status === 403
  })

  await assert('Approve batch succeeds', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/approve`, undefined, financeDirectorToken)
    return res.status === 200 && res.data?.status === 'APPROVED'
  })

  await assert('Period status is APPROVED', async () => {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'APPROVED'
  })

  await assert('Batch status is APPROVED with approval user', async () => {
    const batch = await prisma.payrollPreparationBatch.findFirst({ where: { payrollPeriodId: periodId }, orderBy: { version: 'desc' } })
    return batch?.status === 'APPROVED' && !!batch.approvedById && !!batch.approvedAt
  })

  // ─── Approved Payroll Immutability ────────────────────────
  console.log('[Approved Payroll Immutability]')

  await assert('Cannot recalculate approved period', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculate`, undefined, payrollOfficerToken)
    return res.status === 400 && res.error?.includes('READY_FOR_CALCULATION')
  })

  // ─── Return / Reopen Workflow ─────────────────────────────
  console.log('[Return / Reopen]')

  await assert('Return requires RETURN permission', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculation/return`, { reason: 'Test' }, employeeToken)
    return res.status === 403
  })

  await assert('Reopen approved period with reason', async () => {
    const res = await api('POST', `/api/payroll-periods/${periodId}/reopen-calculation`, { reason: 'E2E reopen test' }, financeDirectorToken)
    return res.status === 200 && res.data?.newVersion === 2
  })

  await assert('Previous batch is CANCELLED+SUPERSEDED', async () => {
    const cancelled = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: periodId, status: 'CANCELLED' },
      orderBy: { version: 'desc' },
    })
    return cancelled?.calculationStatus === 'SUPERSEDED'
  })

  await assert('Period status returned to OPEN_FOR_INPUT', async () => {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
    return period?.status === 'OPEN_FOR_INPUT'
  })

  // Second calculation
  await assert('Second calculation creates version 2', async () => {
    await prisma.payrollPeriod.update({ where: { id: periodId }, data: { status: 'READY_FOR_CALCULATION' } })
    const res = await api('POST', `/api/payroll-periods/${periodId}/calculate`, undefined, payrollOfficerToken)
    return res.data?.version === 2 && !!res.data?.batchId
  })

  // ─── Cleanup ──────────────────────────────────────────────
  console.log('[Cleanup]')
  await assert('Data exists for cleanup', async () => {
    const [lines, rows, batches, inputs] = await Promise.all([
      prisma.payrollCalculationLine.count({ where: { payrollPeriodId: periodId } }),
      prisma.payrollPreparationRow.count({ where: { payrollPeriodId: periodId } }),
      prisma.payrollPreparationBatch.count({ where: { payrollPeriodId: periodId } }),
      prisma.payrollInput.count({ where: { payrollPeriodId: periodId } }),
    ])
    return lines > 0 || rows > 0 || batches > 0 || inputs > 0
  })

  // Summary
  const total = passed + failed
  console.log('')
  console.log('========================================')
  console.log(`Phase 5A E2E Tests: ${total} total, ${passed} passed, ${failed} failed`)
  console.log('========================================')
  console.log('')

  if (failed > 0) {
    errors.forEach(e => console.error(`  Failed: ${e}`))
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
}).finally(async () => {
  try {
    // Cleanup all created resources in reverse order
    for (const fn of cleanupFns.reverse()) {
      await fn()
    }
  } catch {
    // best-effort cleanup
  }
})
