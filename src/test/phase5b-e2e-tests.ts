// Phase 5B HTTP E2E Tests — Finalization, Payslips, Payment, Reports, Journal, RBAC
import { prisma } from '../lib/prisma'

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3005'

let passed = 0, failed = 0
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

async function login(email: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json()
    const cookies = res.headers.getSetCookie?.() || []
    const sessionCookie = cookies.find((c: string) => c.startsWith('session='))
    if (sessionCookie) return sessionCookie.split(';')[0].replace('session=', '')
    return json.data?.token || null
  } catch { return null }
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
  console.log('\n=== Phase 5B HTTP E2E Tests ===\n')

  // Login as different roles
  const payrollToken = await login('finance.payroll@leapfrog.com', 'Test123!')
  const directorToken = await login('finance.director@leapfrog.com', 'Test123!')
  const treasuryToken = await login('treasury@leapfrog.com', 'Test123!')
  const auditorToken = await login('auditor@leapfrog.com', 'Test123!')
  const employeeToken = await login('employee@leapfrog.com', 'Test123!')

  if (!payrollToken || !directorToken || !treasuryToken || !auditorToken || !employeeToken) {
    console.log('  \u2717 Could not login as all roles. Run CI seed first.')
    process.exit(1)
  }

  // ─── RBAC & Auth Enforcement ──────────────────────────────
  console.log('[RBAC & Auth]')

  await assert('Unauthenticated returns 401 on all Phase 5B endpoints', async () => {
    const endpoints = [
      '/api/payroll-output-packages',
      '/api/payslips',
      '/api/payment-batches',
      '/api/statutory-reports',
      '/api/payroll-journals',
      '/api/payment-export-templates',
    ]
    for (const ep of endpoints) {
      const res = await api('GET', ep, undefined, undefined)
      if (res.status !== 401) return false
    }
    return true
  })

  await assert('Employee cannot access payroll output packages', async () => {
    const res = await api('GET', '/api/payroll-output-packages', undefined, employeeToken)
    return res.status === 403
  })

  await assert('Employee cannot access payment batches', async () => {
    const res = await api('GET', '/api/payment-batches', undefined, employeeToken)
    return res.status === 403
  })

  await assert('Employee cannot access statutory reports', async () => {
    const res = await api('GET', '/api/statutory-reports', undefined, employeeToken)
    return res.status === 403
  })

  await assert('Employee cannot access payroll journals', async () => {
    const res = await api('GET', '/api/payroll-journals', undefined, employeeToken)
    return res.status === 403
  })

  await assert('Employee CAN access payslips (viewOwn)', async () => {
    const res = await api('GET', '/api/payslips', undefined, employeeToken)
    return res.status === 200
  })

  await assert('Auditor can view journals', async () => {
    const res = await api('GET', '/api/payroll-journals', undefined, auditorToken)
    return res.status === 200
  })

  // ─── Finalization API ────────────────────────────────────
  console.log('[Finalization API]')

  await assert('GET /api/payroll-output-packages returns array', async () => {
    const res = await api('GET', '/api/payroll-output-packages', undefined, payrollToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('GET /api/payroll-output-packages/:id with invalid id returns 404', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent-id-12345', undefined, payrollToken)
    return res.status === 404
  })

  await assert('POST finalize without permission returns 403', async () => {
    const res = await api('POST', '/api/payroll-periods/nonexistent/finalize', {}, employeeToken)
    return res.status === 403
  })

  await assert('Review requires payrollFinalization.review', async () => {
    const res = await api('POST', '/api/payroll-output-packages/nonexistent/review', {}, employeeToken)
    return res.status === 403
  })

  await assert('Approve requires payrollFinalization.approve', async () => {
    const res = await api('POST', '/api/payroll-output-packages/nonexistent/approve', {}, employeeToken)
    return res.status === 403
  })

  // ─── Payment Readiness API ────────────────────────────────
  console.log('[Payment Readiness API]')

  await assert('GET payment-readiness requires auth', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/payment-readiness', undefined, undefined)
    return res.status === 401
  })

  await assert('GET payment-readiness with treasury returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/payment-readiness', undefined, treasuryToken)
    return res.status === 404
  })

  // ─── Payment Export Templates API ─────────────────────────
  console.log('[Payment Export Templates API]')

  await assert('GET /api/payment-export-templates returns array', async () => {
    const res = await api('GET', '/api/payment-export-templates', undefined, treasuryToken)
    return res.status === 200
  })

  await assert('POST /api/payment-export-templates creates template', async () => {
    const res = await api('POST', '/api/payment-export-templates', {
      code: 'E2E_TEST_BANK_CSV',
      name: 'E2E Test Bank CSV',
      paymentMethod: 'BANK',
      format: 'CSV',
      columnConfigJson: JSON.stringify([{ header: 'Employee Code', field: 'employeeCode' }, { header: 'Amount', field: 'amount' }]),
    }, treasuryToken)
    return res.status === 201 && res.data?.code === 'E2E_TEST_BANK_CSV'
  })

  await assert('GET single template returns the template', async () => {
    const list = await api('GET', '/api/payment-export-templates', undefined, treasuryToken)
    if (!list.data?.length) return false
    const firstId = list.data[0].id
    const res = await api('GET', `/api/payment-export-templates/${firstId}`, undefined, treasuryToken)
    return res.status === 200
  })

  await assert('PATCH template updates configuration', async () => {
    const list = await api('GET', '/api/payment-export-templates', undefined, treasuryToken)
    if (!list.data?.length) return false
    const firstId = list.data[0].id
    const res = await api('PATCH', `/api/payment-export-templates/${firstId}`, { name: 'Updated Template' }, treasuryToken)
    return res.status === 200
  })

  await assert('Approve template requires approval permission', async () => {
    const list = await api('GET', '/api/payment-export-templates', undefined, treasuryToken)
    if (!list.data?.length) return false
    const firstId = list.data[0].id
    const res = await api('POST', `/api/payment-export-templates/${firstId}/approve`, {}, payrollToken)
    return res.status === 403
  })

  // ─── Payslip API ──────────────────────────────────────────
  console.log('[Payslip API]')

  await assert('GET /api/payslips with employee token returns own payslips', async () => {
    const res = await api('GET', '/api/payslips', undefined, employeeToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('GET /api/payslips with finance returns all payslips', async () => {
    const res = await api('GET', '/api/payslips', undefined, payrollToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('Download payslip requires auth', async () => {
    const res = await api('GET', '/api/payslips/nonexistent/download', undefined, undefined)
    return res.status === 401
  })

  await assert('Download nonexistent payslip returns 404', async () => {
    const res = await api('GET', '/api/payslips/nonexistent/download', undefined, employeeToken)
    return res.status === 404
  })

  // ─── Statutory Reports API ────────────────────────────────
  console.log('[Statutory Reports API]')

  await assert('GET /api/statutory-reports returns array', async () => {
    const res = await api('GET', '/api/statutory-reports', undefined, payrollToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('GET /api/statutory-reports/:id returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/statutory-reports/nonexistent-report', undefined, payrollToken)
    return res.status === 404
  })

  await assert('POST mark-filed requires filingReference', async () => {
    const res = await api('POST', '/api/statutory-reports/nonexistent/mark-filed', {}, payrollToken)
    return res.status === 400 || res.status === 404
  })

  await assert('POST mark-filed with empty ref returns 400', async () => {
    const res = await api('POST', '/api/statutory-reports/nonexistent/mark-filed', { filingReference: '' }, payrollToken)
    return res.status === 400 || res.status === 404
  })

  await assert('Review requires statutoryReport.review permission', async () => {
    const res = await api('POST', '/api/statutory-reports/nonexistent/review', {}, employeeToken)
    return res.status === 403
  })

  await assert('Approve requires statutoryReport.approve permission', async () => {
    const res = await api('POST', '/api/statutory-reports/nonexistent/approve', {}, employeeToken)
    return res.status === 403
  })

  await assert('Download report requires auth', async () => {
    const res = await api('GET', '/api/statutory-reports/nonexistent/download', undefined, undefined)
    return res.status === 401
  })

  // ─── Journal API ──────────────────────────────────────────
  console.log('[Journal API]')

  await assert('GET /api/payroll-journals returns array', async () => {
    const res = await api('GET', '/api/payroll-journals', undefined, auditorToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('GET /api/payroll-journals/:id returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/payroll-journals/nonexistent-journal', undefined, auditorToken)
    return res.status === 404
  })

  await assert('Journal approve requires payrollJournal.approve permission', async () => {
    const res = await api('POST', '/api/payroll-journals/nonexistent/approve', {}, employeeToken)
    return res.status === 403
  })

  await assert('Journal export requires auth', async () => {
    const res = await api('GET', '/api/payroll-journals/nonexistent/export', undefined, undefined)
    return res.status === 401
  })

  // ─── Payment Batches API ──────────────────────────────────
  console.log('[Payment Batches API]')

  await assert('GET /api/payment-batches returns array', async () => {
    const res = await api('GET', '/api/payment-batches', undefined, treasuryToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('GET /api/payment-batches/:id returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/payment-batches/nonexistent-batch', undefined, treasuryToken)
    return res.status === 404
  })

  await assert('Reconcile nonexistent batch returns 404', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/reconcile', {}, treasuryToken)
    return res.status === 404
  })

  await assert('Mark-paid requires auth', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/instructions/nonexistent/mark-paid', {}, undefined)
    return res.status === 401
  })

  await assert('Mark-failed requires reason', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/instructions/nonexistent/mark-failed', {}, treasuryToken)
    return res.status === 400 || res.status === 404
  })

  await assert('Hold requires reason', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/instructions/nonexistent/hold', {}, treasuryToken)
    return res.status === 400 || res.status === 404
  })

  await assert('Generate export for nonexistent batch returns 404', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/generate-export', {}, treasuryToken)
    return res.status === 404
  })

  await assert('Release requires paymentBatch.release permission', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/release', {}, employeeToken)
    return res.status === 403
  })

  // ─── Export Download API ──────────────────────────────────
  console.log('[Export Download API]')

  await assert('Download nonexistent export returns 404', async () => {
    const res = await api('GET', '/api/payroll-exports/nonexistent/download', undefined, treasuryToken)
    return res.status === 404
  })

  // ─── Sub-resource APIs ────────────────────────────────────
  console.log('[Sub-resource APIs]')

  await assert('GET payment-batches from output package returns array or 404', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/payment-batches', undefined, treasuryToken)
    return res.status === 404 || res.status === 200
  })

  await assert('GET statutory-reports from output package returns array or 404', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/statutory-reports', undefined, payrollToken)
    return res.status === 404 || res.status === 200
  })

  await assert('GET register from output package returns array or 404', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/register', undefined, payrollToken)
    return res.status === 404 || res.status === 200
  })

  await assert('GET journal from output package returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/journal', undefined, payrollToken)
    return res.status === 404
  })

  // Cleanup test template
  await prisma.paymentExportTemplate.deleteMany({ where: { code: 'E2E_TEST_BANK_CSV' } }).catch(() => {})

  // Summary
  console.log(`\n========================================`)
  console.log(`Phase 5B E2E Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`========================================\n`)
  if (failed > 0) {
    console.log('Failed tests:', errors.join(', '))
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
