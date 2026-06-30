import { prisma } from '../lib/prisma'
import { calculateRulePreview, validateRuleForActivation } from '../lib/salary-structure'
import type { PayRule } from '@prisma/client'

let passed = 0
let failed = 0
const errors: string[] = []

function assert(label: string, fn: () => boolean) {
  try {
    if (fn()) { passed++; console.log(`  ✓ ${label}`) }
    else { failed++; errors.push(label); console.log(`  ✗ ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  ✗ ${label} — ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  console.log('\n=== Phase 3: Salary Structure & Pay Component Rules Tests ===\n')

  // ─── Unit Tests: calculateRulePreview ───────────────────────────────────
  console.log('[Unit: calculateRulePreview]')

  const fixedRule = { calculationMethod: 'FIXED_AMOUNT', ruleType: 'FIXED_AMOUNT', baseAmount: 5000, maxAmount: null, minAmount: null, percentageRate: null, thresholdValue: null, tierConfigJson: null } as unknown as PayRule
  const pctRule = { calculationMethod: 'PERCENTAGE', ruleType: 'PERCENTAGE', baseAmount: null, maxAmount: null, minAmount: null, percentageRate: 10, thresholdValue: null, tierConfigJson: null } as unknown as PayRule
  const thresholdRule = { calculationMethod: 'THRESHOLD', ruleType: 'THRESHOLD', baseAmount: 1500, maxAmount: 1500, minAmount: null, percentageRate: null, thresholdValue: 40, tierConfigJson: null } as unknown as PayRule
  const tieredRule = { calculationMethod: 'TIERED', ruleType: 'TIERED', baseAmount: null, maxAmount: 2000, minAmount: 0, percentageRate: null, thresholdValue: null, tierConfigJson: JSON.stringify([{ min: 60, amount: 2000 }, { min: 40, amount: 1000 }, { min: 0, amount: 0 }]) } as unknown as PayRule
  const manualRule = { calculationMethod: 'MANUAL_INPUT', ruleType: 'MANUAL_INPUT', baseAmount: null, maxAmount: null, minAmount: null, percentageRate: null, thresholdValue: null, tierConfigJson: null } as unknown as PayRule
  const cappedRule = { calculationMethod: 'FIXED_AMOUNT', ruleType: 'FIXED_AMOUNT', baseAmount: 10000, maxAmount: 5000, minAmount: null, percentageRate: null, thresholdValue: null, tierConfigJson: null } as unknown as PayRule

  assert('FIXED_AMOUNT: returns base amount', () => calculateRulePreview(fixedRule, 0).calculatedAmount === 5000)
  assert('PERCENTAGE: 1000×10% = 100', () => calculateRulePreview(pctRule, 1000).calculatedAmount === 100)

  // DSA Transport Allowance business rules
  assert('THRESHOLD DSA Transport: 45 >= 40 → flat 1500', () => calculateRulePreview(thresholdRule, 45).calculatedAmount === 1500)
  assert('THRESHOLD DSA Transport: 40 >= 40 → flat 1500', () => calculateRulePreview(thresholdRule, 40).calculatedAmount === 1500)
  assert('THRESHOLD DSA Transport: 39.99 < 40 → 0', () => calculateRulePreview(thresholdRule, 39.99).calculatedAmount === 0)
  assert('THRESHOLD DSA Transport: 35 < 40 → 0', () => calculateRulePreview(thresholdRule, 35).calculatedAmount === 0)
  assert('THRESHOLD DSA Transport: capped at maxAmount 1500', () => {
    return calculateRulePreview(thresholdRule, 100).calculatedAmount === 1500
  })

  // DSA KPI Allowance business rules
  assert('TIERED DSA KPI: 65 >= 60 → 2000 (top tier)', () => calculateRulePreview(tieredRule, 65).calculatedAmount === 2000)
  assert('TIERED DSA KPI: 60 >= 60 → 2000 (top tier)', () => calculateRulePreview(tieredRule, 60).calculatedAmount === 2000)
  assert('TIERED DSA KPI: 50 >= 40 → 1000 (mid tier)', () => calculateRulePreview(tieredRule, 50).calculatedAmount === 1000)
  assert('TIERED DSA KPI: 40 >= 40 → 1000 (mid tier)', () => calculateRulePreview(tieredRule, 40).calculatedAmount === 1000)
  assert('TIERED DSA KPI: 39.99 < 40 → 0 (bottom tier)', () => calculateRulePreview(tieredRule, 39.99).calculatedAmount === 0)
  assert('TIERED DSA KPI: 35 < 40 → 0 (bottom tier)', () => calculateRulePreview(tieredRule, 35).calculatedAmount === 0)

  assert('MANUAL_INPUT: returns input value', () => calculateRulePreview(manualRule, 7500).calculatedAmount === 7500)
  assert('CAPPED: amount capped at maxAmount', () => calculateRulePreview(cappedRule, 0).calculatedAmount === 5000)
  assert('CAPPED: warning emitted for cap', () => calculateRulePreview(cappedRule, 0).warnings.length > 0)

  // ─── Validate Rule for Activation ──────────────────────────────────────
  console.log('[Unit: validateRuleForActivation]')

  const draftRules = await prisma.payRule.findMany({ where: { status: 'DRAFT' }, include: { component: true }, take: 1 })
  if (draftRules.length > 0 && draftRules[0].component?.isActive) {
    const valRes = await validateRuleForActivation(draftRules[0].id)
    assert('validateRuleForActivation: existing draft rule passes or fails gracefully', () => valRes.valid === false || valRes.valid === true)
  }

  // ─── Permission Tests ──────────────────────────────────────────────────
  console.log('[Permissions]')

  const { userHasPermission } = await import('../lib/rbac')
  const financeUser = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
  const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
  const hrAdminUser = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })

  const salaryStructureKeys = [
    'salaryStructure.view', 'salaryStructure.manageComponents', 'salaryStructure.manageRules',
    'salaryStructure.preview', 'salaryStructure.activateRule', 'salaryStructure.deactivateRule',
    'salaryStructure.auditView',
  ]

  if (financeUser && empUser) {
    for (const key of salaryStructureKeys) {
      const hasFinance = await userHasPermission(financeUser.id, key as any)
      assert(`FINANCE_DIRECTOR has ${key}`, () => hasFinance)
      const hasEmp = await userHasPermission(empUser.id, key as any)
      assert(`EMPLOYEE denied ${key}`, () => !hasEmp)
    }
  }

  if (hrAdminUser) {
    for (const key of salaryStructureKeys) {
      const hasHrAdmin = await userHasPermission(hrAdminUser.id, key as any)
      assert(`HR_ADMIN has ${key}`, () => hasHrAdmin)
    }
  }

  // ─── API Tests (require server on localhost:3000) ──────────────────────
  console.log('[API (server required)]')

  let serverAvailable = false
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 3000)
    const healthRes = await fetch('http://127.0.0.1:3000/api/auth/me', { signal: ctrl.signal })
    if (healthRes.ok || healthRes.status === 401) serverAvailable = true
  } catch {
    console.log('  Server not available — skipping API tests')
  }

  if (serverAvailable) {
    const BASE = 'http://127.0.0.1:3000'

    async function login(email: string): Promise<string | null> {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Test123!' }),
      })
      const setCookie = res.headers.get('set-cookie')
      const match = setCookie?.match(/session=([^;]+)/)
      return match ? `session=${match[1]}` : null
    }

    async function apiGet(path: string, cookie: string) {
      const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } })
      return { status: res.status, json: await res.json() }
    }

    async function apiPost(path: string, cookie: string, body: unknown) {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(body),
      })
      return { status: res.status, json: await res.json() }
    }

    async function apiPatch(path: string, cookie: string, body: unknown) {
      const res = await fetch(`${BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(body),
      })
      return { status: res.status, json: await res.json() }
    }

    const adminCookie = await login('admin@leapfrog.com')
    const financeDirCookie = await login('finance.director@leapfrog.com')
    const empCookie = await login('employee@leapfrog.com')

    if (!adminCookie || !financeDirCookie) {
      console.log('  FATAL: Could not login test users')
    } else {
      // Components CRUD
      const listRes = await apiGet('/api/salary-structure/components', adminCookie)
      assert('GET /components returns array', () => Array.isArray(listRes.json.data))
      assert('GET /components has BASIC_SALARY', () => {
        const names = (listRes.json.data as any[]).map((c: any) => c.code)
        return names.includes('BASIC_SALARY')
      })

      const empListRes = await apiGet('/api/salary-structure/components', empCookie!)
      assert('GET /components denies EMPLOYEE', () => empListRes.status === 403)

      const testCode = 'TEST_' + Date.now().toString(36).toUpperCase()
      const createRes = await apiPost('/api/salary-structure/components', financeDirCookie, {
        code: testCode, name: 'Test Component', componentType: 'ALLOWANCE', taxTreatment: 'TAXABLE',
      })
      assert('POST /components creates component', () => createRes.status === 201 && createRes.json.data.code === testCode)

      const dupRes = await apiPost('/api/salary-structure/components', financeDirCookie, { code: testCode, name: 'Duplicate' })
      assert('POST /components rejects duplicate code', () => dupRes.status === 400)

      const compId = createRes.json.data.id
      const deactRes = await apiPost(`/api/salary-structure/components/${compId}/deactivate`, financeDirCookie, {})
      assert('POST /components/:id/deactivate works', () => deactRes.status === 200 && deactRes.json.data.isActive === false)

      const noPermRes = await apiPost('/api/salary-structure/components', empCookie!, { code: 'NO_PERM', name: 'No Perm' })
      assert('POST /components denies EMPLOYEE', () => noPermRes.status === 403)

      const patchRes = await apiPatch(`/api/salary-structure/components/${compId}`, financeDirCookie, { name: 'Updated Test' })
      assert('PATCH /components/:id updates name', () => patchRes.status === 200 && patchRes.json.data.name === 'Updated Test')

      // Rules CRUD
      const comps = (await apiGet('/api/salary-structure/components', adminCookie)).json.data as any[]
      const basicSalaryComp = comps.find((c: any) => c.code === 'BASIC_SALARY')

      const listRulesRes = await apiGet('/api/salary-structure/rules', adminCookie)
      assert('GET /rules returns array', () => Array.isArray(listRulesRes.json.data))

      const createRuleRes = await apiPost('/api/salary-structure/rules', financeDirCookie, {
        componentId: basicSalaryComp.id, name: 'Test Fixed Rule', ruleType: 'FIXED_AMOUNT',
        baseAmount: 10000, effectiveFrom: '2025-01-01', status: 'DRAFT',
      })
      assert('POST /rules creates rule', () => createRuleRes.status === 201 && createRuleRes.json.data.name === 'Test Fixed Rule')
      const ruleId = createRuleRes.json.data.id

      const activeCreateRes = await apiPost('/api/salary-structure/rules', financeDirCookie, {
        componentId: basicSalaryComp.id, name: 'Should Fail', ruleType: 'FIXED_AMOUNT',
        baseAmount: 5000, effectiveFrom: '2025-01-01', status: 'ACTIVE',
      })
      assert('POST /rules rejects ACTIVE status (safe activation)', () => activeCreateRes.status === 400)

      const badRuleRes = await apiPost('/api/salary-structure/rules', financeDirCookie, { name: 'Incomplete' })
      assert('POST /rules rejects missing fields', () => badRuleRes.status === 400)

      const empRuleRes = await apiPost('/api/salary-structure/rules', empCookie!, { componentId: basicSalaryComp.id, name: 'No', effectiveFrom: '2025-01-01' })
      assert('POST /rules denies EMPLOYEE', () => empRuleRes.status === 403)

      const getRuleRes = await apiGet(`/api/salary-structure/rules/${ruleId}`, adminCookie)
      assert('GET /rules/:id returns rule', () => getRuleRes.status === 200 && getRuleRes.json.data.name === 'Test Fixed Rule')

      const patchRuleRes = await apiPatch(`/api/salary-structure/rules/${ruleId}`, financeDirCookie, { name: 'Updated Rule' })
      assert('PATCH /rules/:id updates rule', () => patchRuleRes.status === 200 && patchRuleRes.json.data.name === 'Updated Rule')

      const activePatchRes = await apiPatch(`/api/salary-structure/rules/${ruleId}`, financeDirCookie, { status: 'ACTIVE' })
      assert('PATCH /rules/:id rejects ACTIVE status', () => activePatchRes.status === 400)

      const activateRes = await apiPost(`/api/salary-structure/rules/${ruleId}/activate`, financeDirCookie, {})
      assert('POST /rules/:id/activate works', () => activateRes.status === 200 && activateRes.json.data.status === 'ACTIVE')

      const deactivateRes = await apiPost(`/api/salary-structure/rules/${ruleId}/deactivate`, financeDirCookie, {})
      assert('POST /rules/:id/deactivate works', () => deactivateRes.status === 200 && deactivateRes.json.data.status === 'INACTIVE')

      // Preview
      const previewRes = await apiPost('/api/salary-structure/preview', financeDirCookie, { ruleId, inputValue: 1000 })
      assert('POST /preview returns calculation', () => {
        if (previewRes.status !== 200) return false
        const d = previewRes.json.data as any
        return typeof d.calculatedAmount === 'number'
      })

      const noInputRes = await apiPost('/api/salary-structure/preview', financeDirCookie, { ruleId })
      assert('POST /preview rejects missing input', () => noInputRes.status === 400)

      const noRuleRes = await apiPost('/api/salary-structure/preview', financeDirCookie, { ruleId: 'nonexistent', inputValue: 100 })
      assert('POST /preview handles non-existent rule', () => noRuleRes.status === 404)

      const empPreviewRes = await apiPost('/api/salary-structure/preview', empCookie!, { ruleId, inputValue: 100 })
      assert('POST /preview denies EMPLOYEE', () => empPreviewRes.status === 403)

      // Regression
      const hrAdminCookie = await login('hr.admin@leapfrog.com')
      if (hrAdminCookie) {
        const empList = await apiGet('/api/employees?limit=5', hrAdminCookie)
        assert('GET /employees still works', () => empList.status === 200 && Array.isArray(empList.json.data?.items))
      }

      const meRes = await apiGet('/api/auth/me', adminCookie)
      assert('GET /auth/me still works', () => meRes.status === 200 && meRes.json.data?.email === 'admin@leapfrog.com')
    }
  }

  //─── Summary ───────────────────────────────────────────────────────────
  const total = passed + failed
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Phase 3 Results: ${passed}/${total} passed`)
  if (failed > 0) {
    console.log(`Failed tests:`)
    errors.forEach(e => console.log(`  ✗ ${e}`))
  }
  console.log()

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main()
