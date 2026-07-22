/**
 * MVP Payroll HTTP E2E Tests
 *
 * Run with: tsx src/test/mvp-payroll-e2e.ts
 * Requires: running dev server on http://localhost:3000
 */

const BASE = 'http://localhost:3000'

let passed = 0
let failed = 0
const errors: string[] = []

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: globalCookie || '' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: Record<string, unknown>
  try { json = JSON.parse(text) } catch { json = { error: text.substring(0, 100) } }
  return { status: res.status, data: (json.data as Record<string, unknown>) || json, error: json.error as string | undefined }
}

const globalCookie = ''

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
  console.log('\n=== MVP Payroll E2E Tests ===\n')

  // Health check
  console.log('[Health Check]')
  try {
    await fetch(`${BASE}/api/auth/me`)
    console.log('  ✓ Server is reachable')
  } catch {
    console.log('  ✗ Cannot reach server - start with "npm run dev" first')
    process.exit(1)
  }

  await api('GET', '/api/auth/me')

  // ── Payroll Period API ──────────────────────────────
  console.log('\n[Payroll Period API]')
  await assert('GET /api/payroll returns list', async () => {
    const res = await api('GET', '/api/payroll')
    return res.status === 200
  })

  // Payroll period detail
  await assert('Payroll period model accessible', async () => {
    const res = await api('GET', '/api/payroll')
    const data = res.data as Record<string, unknown>
    const items = data.items as Array<Record<string, unknown>> | undefined
    if (items && items.length > 0) {
      const id = items[0].id as string
      const detailRes = await api('GET', `/api/payroll/${id}`)
      return detailRes.status === 200 && detailRes.data !== undefined
    }
    return true // no data yet - acceptable
  })

  // ── Audit ──────────────────────────────
  console.log('\n[Audit]')
  await assert('Audit log accessible', async () => {
    const res = await api('GET', '/api/audit-logs')
    return res.status === 200
  })

  console.log(`\n${'='.repeat(40)}`)
  console.log(`MVP Payroll E2E: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
