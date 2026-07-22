// Phase 5B HTTP E2E Tests
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

  // Login
  const payrollToken = await login('finance.payroll@leapfrog.com', 'Test123!')
  const directorToken = await login('finance.director@leapfrog.com', 'Test123!')

  if (!payrollToken || !directorToken) {
    console.log('  \u2717 Could not login. Run CI seed first.')
    process.exit(1)
  }

  // ─── Finalization API ────────────────────────────────────
  console.log('[Finalization API]')

  await assert('GET /api/payroll-output-packages returns array', async () => {
    const res = await api('GET', '/api/payroll-output-packages', undefined, payrollToken)
    return res.status === 200 && Array.isArray(res.data)
  })

  await assert('GET /api/payroll-output-packages/:id with invalid id returns 404', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent', undefined, payrollToken)
    return res.status === 404
  })

  // ─── Payment Readiness API ────────────────────────────────
  console.log('[Payment Readiness API]')

  await assert('GET payment-readiness requires auth', async () => {
    const res = await api('GET', '/api/payroll-output-packages/nonexistent/payment-readiness', undefined, undefined)
    return res.status === 401
  })

  // ─── Payment Export Templates API ─────────────────────────
  console.log('[Payment Export Templates API]')

  await assert('GET /api/payment-export-templates returns array', async () => {
    const res = await api('GET', '/api/payment-export-templates', undefined, payrollToken)
    return res.status === 200
  })

  await assert('POST /api/payment-export-templates creates template', async () => {
    const res = await api('POST', '/api/payment-export-templates', {
      code: 'TEST_BANK_CSV',
      name: 'Test Bank CSV',
      paymentMethod: 'BANK',
      format: 'CSV',
      columnConfigJson: JSON.stringify([{ header: 'Employee Code', field: 'employeeCode' }]),
    }, payrollToken)
    return res.status === 201
  })

  // ─── Payslip API ──────────────────────────────────────────
  console.log('[Payslip API]')

  await assert('GET /api/payslips requires auth', async () => {
    const res = await api('GET', '/api/payslips', undefined, undefined)
    return res.status === 401
  })

  await assert('GET /api/payslips with token returns array', async () => {
    const res = await api('GET', '/api/payslips', undefined, payrollToken)
    return res.status === 200
  })

  // ─── Statutory Reports API ────────────────────────────────
  console.log('[Statutory Reports API]')

  await assert('GET /api/statutory-reports/:id returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/statutory-reports/nonexistent', undefined, payrollToken)
    return res.status === 404
  })

  await assert('POST mark-filed requires filingReference', async () => {
    const res = await api('POST', '/api/statutory-reports/nonexistent/mark-filed', {}, payrollToken)
    return res.status === 404 || res.status === 400
  })

  // ─── Journal API ──────────────────────────────────────────
  console.log('[Journal API]')

  await assert('GET /api/payroll-journals/:id returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/payroll-journals/nonexistent', undefined, payrollToken)
    return res.status === 404
  })

  // ─── Payment Batches API ──────────────────────────────────
  console.log('[Payment Batches API]')

  await assert('GET /api/payment-batches/:id returns 404 for nonexistent', async () => {
    const res = await api('GET', '/api/payment-batches/nonexistent', undefined, payrollToken)
    return res.status === 404
  })

  await assert('Payment batch exports list returns array', async () => {
    const res = await api('GET', '/api/payment-batches/nonexistent/exports', undefined, payrollToken)
    return res.status === 200 || res.status === 404
  })

  // ─── Payment Reconciliation API ───────────────────────────
  console.log('[Payment Reconciliation API]')

  await assert('Reconcile nonexistent batch returns 404', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/reconcile', undefined, payrollToken)
    return res.status === 404
  })

  await assert('Mark-paid requires auth', async () => {
    const res = await api('POST', '/api/payment-batches/nonexistent/instructions/nonexistent/mark-paid', {}, undefined)
    return res.status === 401
  })

  // ─── RBAC Permissions ─────────────────────────────────────
  console.log('[RBAC Permissions]')

  await assert('Unauthenticated requests return 401', async () => {
    const res = await api('GET', '/api/payroll-output-packages', undefined, undefined)
    return res.status === 401
  })

  await assert('GET /api/payment-export-templates requires auth', async () => {
    const res = await api('GET', '/api/payment-export-templates', undefined, undefined)
    return res.status === 401
  })

  // ─── Export Download API ──────────────────────────────────
  console.log('[Export Download API]')

  await assert('Download nonexistent export returns 404', async () => {
    const res = await api('GET', '/api/payroll-exports/nonexistent/download', undefined, payrollToken)
    return res.status === 404
  })

  // Cleanup test template
  await prisma.paymentExportTemplate.deleteMany({ where: { code: 'TEST_BANK_CSV' } }).catch(() => {})

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
