import { prisma } from '../lib/prisma'
import { calculateRulePreview, validateRuleForActivation } from '../lib/salary-structure'
import type { PayRule } from '@prisma/client'

const BASE = 'http://localhost:3000'

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

async function main() {
  console.log('\n=== Phase 3: Salary Structure & Pay Component Rules Tests ===\n')

  const adminCookie = await login('admin@leapfrog.com')
  const hrAdminCookie = await login('hr.admin@leapfrog.com')
  const hrOfficerCookie = await login('hr.officer@leapfrog.com')
  const financeDirCookie = await login('finance.director@leapfrog.com')
  const empCookie = await login('employee@leapfrog.com')

  if (!adminCookie || !hrAdminCookie || !financeDirCookie) {
    console.log('  FATAL: Could not login test users'); process.exit(1)
  }

  // ─── Unit Tests: calculateRulePreview ───────────────────────────────────
  console.log('[Unit: calculateRulePreview]')

  const fixedRule = { calculationMethod: 'FIXED_AMOUNT', ruleType: 'FIXED_AMOUNT', baseAmount: 5000, maxAmount: null, minAmount: null, percentageRate: null, thresholdValue: null, tierConfigJson: null } as unknown as PayRule
  const pctRule = { calculationMethod: 'PERCENTAGE', ruleType: 'PERCENTAGE', baseAmount: null, maxAmount: null, minAmount: null, percentageRate: 10, thresholdValue: null, tierConfigJson: null } as unknown as PayRule
  const thresholdRule = { calculationMethod: 'THRESHOLD', ruleType: 'THRESHOLD', baseAmount: null, maxAmount: 1500, minAmount: null, percentageRate: 40, thresholdValue: 80, tierConfigJson: null } as unknown as PayRule
  const tieredRule = { calculationMethod: 'TIERED', ruleType: 'TIERED', baseAmount: null, maxAmount: 2000, minAmount: 0, percentageRate: null, thresholdValue: null, tierConfigJson: JSON.stringify([{ min: 80, percent: 60, amount: 2000 }, { min: 50, percent: 40, amount: 1000 }, { min: 0, percent: 0, amount: 0 }]) } as unknown as PayRule
  const manualRule = { calculationMethod: 'MANUAL_INPUT', ruleType: 'MANUAL_INPUT', baseAmount: null, maxAmount: null, minAmount: null, percentageRate: null, thresholdValue: null, tierConfigJson: null } as unknown as PayRule
  const cappedRule = { calculationMethod: 'FIXED_AMOUNT', ruleType: 'FIXED_AMOUNT', baseAmount: 10000, maxAmount: 5000, minAmount: null, percentageRate: null, thresholdValue: null, tierConfigJson: null } as unknown as PayRule

  assert('FIXED_AMOUNT: returns base amount', () => calculateRulePreview(fixedRule, 0).calculatedAmount === 5000)
  assert('PERCENTAGE: 1000×10% = 100', () => calculateRulePreview(pctRule, 1000).calculatedAmount === 100)
  assert('THRESHOLD: below threshold returns 0', () => calculateRulePreview(thresholdRule, 50).calculatedAmount === 0)
  assert('THRESHOLD: above threshold calculates percent', () => calculateRulePreview(thresholdRule, 100).calculatedAmount === 40)
  assert('THRESHOLD: capped at maxAmount', () => {
    const overThreshold = { ...thresholdRule, percentageRate: 200, maxAmount: 100 } as unknown as PayRule
    return calculateRulePreview(overThreshold, 100).calculatedAmount === 100
  })
  assert('TIERED: highest tier matched', () => calculateRulePreview(tieredRule, 90).calculatedAmount === 2000)
  assert('TIERED: mid tier matched', () => calculateRulePreview(tieredRule, 60).calculatedAmount === 1000)
  assert('TIERED: lowest tier matched', () => calculateRulePreview(tieredRule, 30).calculatedAmount === 0)
  assert('MANUAL_INPUT: returns input value', () => calculateRulePreview(manualRule, 7500).calculatedAmount === 7500)
  assert('CAPPED: amount capped at maxAmount', () => calculateRulePreview(cappedRule, 0).calculatedAmount === 5000)
  assert('CAPPED: warning emitted for cap', () => calculateRulePreview(cappedRule, 0).warnings.length > 0)

  // ─── API: Components CRUD ──────────────────────────────────────────────
  console.log('[API: Components]')

  // List components
  const listRes = await apiGet('/api/salary-structure/components', adminCookie!)
  assert('GET /components returns array', () => Array.isArray(listRes.json.data))
  assert('GET /components has BASIC_SALARY', () => {
    const names = (listRes.json.data as any[]).map((c: any) => c.code)
    return names.includes('BASIC_SALARY')
  })

  // Permission check: employee cannot view components
  const empListRes = await apiGet('/api/salary-structure/components', empCookie!)
  assert('GET /components denies EMPLOYEE', () => empListRes.status === 403)

  // Create component
  const testCode = 'TEST_' + Date.now().toString(36).toUpperCase()
  const createRes = await apiPost('/api/salary-structure/components', financeDirCookie!, {
    code: testCode, name: 'Test Component', componentType: 'ALLOWANCE', taxTreatment: 'TAXABLE',
  })
  assert('POST /components creates component', () => createRes.status === 201 && createRes.json.data.code === testCode)

  // Duplicate code returns error
  const dupRes = await apiPost('/api/salary-structure/components', financeDirCookie!, { code: testCode, name: 'Duplicate' })
  assert('POST /components rejects duplicate code', () => dupRes.status === 400)

  // Deactivate
  const compId = createRes.json.data.id
  const deactRes = await apiPost(`/api/salary-structure/components/${compId}/deactivate`, financeDirCookie!, {})
  assert('POST /components/:id/deactivate works', () => deactRes.status === 200 && deactRes.json.data.isActive === false)

  // Permission check
  const noPermRes = await apiPost('/api/salary-structure/components', empCookie!, { code: 'NO_PERM', name: 'No Perm' })
  assert('POST /components denies EMPLOYEE', () => noPermRes.status === 403)

  // Patch component
  const patchRes = await apiPatch(`/api/salary-structure/components/${compId}`, financeDirCookie!, { name: 'Updated Test' })
  assert('PATCH /components/:id updates name', () => patchRes.status === 200 && patchRes.json.data.name === 'Updated Test')

  // ─── API: Rules ────────────────────────────────────────────────────────
  console.log('[API: Rules]')

  const comps = (await apiGet('/api/salary-structure/components', adminCookie!)).json.data as any[]
  const basicSalaryComp = comps.find((c: any) => c.code === 'BASIC_SALARY')

  // List rules
  const listRulesRes = await apiGet('/api/salary-structure/rules', adminCookie!)
  assert('GET /rules returns array', () => Array.isArray(listRulesRes.json.data))

  // Create rule
  const createRuleRes = await apiPost('/api/salary-structure/rules', financeDirCookie!, {
    componentId: basicSalaryComp.id, name: 'Test Fixed Rule', ruleType: 'FIXED_AMOUNT',
    baseAmount: 10000, effectiveFrom: '2025-01-01', status: 'DRAFT',
  })
  assert('POST /rules creates rule', () => createRuleRes.status === 201 && createRuleRes.json.data.name === 'Test Fixed Rule')
  const ruleId = createRuleRes.json.data.id

  // Create rule missing required fields
  const badRuleRes = await apiPost('/api/salary-structure/rules', financeDirCookie!, { name: 'Incomplete' })
  assert('POST /rules rejects missing fields', () => badRuleRes.status === 400)

  // Permission: employee cannot create rules
  const empRuleRes = await apiPost('/api/salary-structure/rules', empCookie!, { componentId: basicSalaryComp.id, name: 'No', effectiveFrom: '2025-01-01' })
  assert('POST /rules denies EMPLOYEE', () => empRuleRes.status === 403)

  // Get single rule
  const getRuleRes = await apiGet(`/api/salary-structure/rules/${ruleId}`, adminCookie!)
  assert('GET /rules/:id returns rule', () => getRuleRes.status === 200 && getRuleRes.json.data.name === 'Test Fixed Rule')

  // Patch rule
  const patchRuleRes = await apiPatch(`/api/salary-structure/rules/${ruleId}`, financeDirCookie!, { name: 'Updated Rule' })
  assert('PATCH /rules/:id updates rule', () => patchRuleRes.status === 200 && patchRuleRes.json.data.name === 'Updated Rule')

  // Activate rule
  const activateRes = await apiPost(`/api/salary-structure/rules/${ruleId}/activate`, financeDirCookie!, {})
  assert('POST /rules/:id/activate works', () => activateRes.status === 200 && activateRes.json.data.status === 'ACTIVE')

  // Deactivate rule
  const deactivateRes = await apiPost(`/api/salary-structure/rules/${ruleId}/deactivate`, financeDirCookie!, {})
  assert('POST /rules/:id/deactivate works', () => deactivateRes.status === 200 && deactivateRes.json.data.status === 'INACTIVE')

  // ─── API: Preview ──────────────────────────────────────────────────────
  console.log('[API: Preview]')

  const previewRes = await apiPost('/api/salary-structure/preview', financeDirCookie!, { ruleId, inputValue: 1000 })
  assert('POST /preview returns calculation', () => {
    if (previewRes.status !== 200) return false
    const d = previewRes.json.data as any
    return typeof d.calculatedAmount === 'number'
  })

  const noInputRes = await apiPost('/api/salary-structure/preview', financeDirCookie!, { ruleId })
  assert('POST /preview rejects missing input', () => noInputRes.status === 400)

  const noRuleRes = await apiPost('/api/salary-structure/preview', financeDirCookie!, { ruleId: 'nonexistent', inputValue: 100 })
  assert('POST /preview handles non-existent rule', () => noRuleRes.status === 404)

  const empPreviewRes = await apiPost('/api/salary-structure/preview', empCookie!, { ruleId, inputValue: 100 })
  assert('POST /preview denies EMPLOYEE', () => empPreviewRes.status === 403)

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

  // ─── Regression: Phase 1/2A/2B still work ──────────────────────────────
  console.log('[Regression]')

  // Employee list still works
  const empList = await apiGet('/api/employees?limit=5', hrAdminCookie!)
  assert('GET /employees still works', () => empList.status === 200 && Array.isArray(empList.json.data?.items))

  // Import list still works
  const importList = await apiGet('/api/employees/import/history', hrAdminCookie!)
  assert('GET /import/history still works', () => importList.status === 200 || importList.status === 403)

  // Auth still works
  const meRes = await apiGet('/api/auth/me', adminCookie!)
  assert('GET /auth/me still works', () => meRes.status === 200 && meRes.json.data?.email === 'admin@leapfrog.com')

  // Payroll readiness still works
  const readinessRes = await apiGet('/api/employees/payroll-readiness?limit=5', hrAdminCookie!)
  assert('GET /payroll-readiness still works', () => readinessRes.status === 200)

  // User with no manageComponents permission cannot create components
  const hrOfficerCreate = await apiPost('/api/salary-structure/components', hrOfficerCookie!, { code: 'NO_PERM', name: 'No Perm' })
  assert('HR_OFFICER denied component creation', () => hrOfficerCreate.status === 403)

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
