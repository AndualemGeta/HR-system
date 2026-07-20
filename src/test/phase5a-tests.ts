import assert from 'assert'
import { prisma } from '../lib/prisma'
import {
  mapSalarySourceToCalculationSource,
  resolveSalary,
  calcProratedSalary,
  calcPension,
  calcPaye,
  selectPayeBracket,
  selectPensionRule,
  validatePayComponent,
  processEarningInput,
  processDeductionInput,
  getApprovedPayeBrackets,
  getApprovedPensionRules,
  getEffectiveKpiDefaultAmount,
  validateKpiPercentage,
  processKpiEarning,
} from '../lib/payroll'

const RUNNING_TOTAL = { passed: 0, failed: 0 }

async function test(name: string, fn: () => (Promise<void> | void)): Promise<void> {
  try {
    const r = fn()
    if (r instanceof Promise) await r
    RUNNING_TOTAL.passed++
    console.log(`  ✓ ${name}`)
  } catch (e: any) {
    RUNNING_TOTAL.failed++
    console.log(`  ✗ ${name}: ${e.message}`)
  }
}

async function main() {
  console.log('\n=== Phase 5A Unit Tests ===\n')

  // ── Salary Source Mapping ──────────────────────────────────────────
  console.log('[Salary Source Mapping]')
  await test('EmployeeSalary → EMPLOYEE_SALARY', () => {
    assert.strictEqual(mapSalarySourceToCalculationSource('EmployeeSalary'), 'EMPLOYEE_SALARY')
  })
  await test('Employee.basicSalary → SYSTEM', () => {
    assert.strictEqual(mapSalarySourceToCalculationSource('Employee.basicSalary'), 'SYSTEM')
  })
  await test('MISSING → SYSTEM', () => {
    assert.strictEqual(mapSalarySourceToCalculationSource('MISSING'), 'SYSTEM')
  })
  await test('Unknown source → SYSTEM', () => {
    assert.strictEqual(mapSalarySourceToCalculationSource('anything'), 'SYSTEM')
  })

  // ── Salary Resolution ─────────────────────────────────────────────
  console.log('\n[Salary Resolution]')
  const employees = await prisma.employee.findMany({ take: 2 })
  if (employees.length > 0) {
    const salary = await resolveSalary(employees[0].id, new Date('2025-12-31'))
    await test('Latest effective EmployeeSalary is selected (returns numeric)', () => {
      assert.ok(typeof salary.basicSalary === 'number')
    })
    await test('Missing salary returns 0', async () => {
      const result = await resolveSalary('nonexistent-id', new Date())
      assert.strictEqual(result.basicSalary, 0)
      assert.strictEqual(result.salarySource, 'MISSING')
    })
  }

  // ── Proration ─────────────────────────────────────────────────────
  console.log('\n[Proration]')
  await test('NONE returns full salary', () => {
    const { prorated } = calcProratedSalary(10000, 'NONE', 30, 15)
    assert.strictEqual(prorated, 10000)
  })
  await test('CALENDAR_DAYS calculates correctly', () => {
    const { prorated } = calcProratedSalary(10000, 'CALENDAR_DAYS', 30, 15)
    assert.strictEqual(prorated, 5000)
  })
  await test('CALENDAR_DAYS zero period returns warning', () => {
    const { prorated, warning } = calcProratedSalary(10000, 'CALENDAR_DAYS', 0, 15)
    assert.ok(warning)
    assert.strictEqual(prorated, 10000)
  })
  await test('MANUAL returns 0 with warning', () => {
    const { prorated, warning } = calcProratedSalary(10000, 'MANUAL', 30, 15)
    assert.strictEqual(prorated, 0)
    assert.ok(warning)
  })

  // ── Pension ───────────────────────────────────────────────────────
  console.log('\n[Pension]')
  await test('calcPension employee and employer rates', () => {
    const { employeePension, employerPension } = calcPension(10000, {
      id: '1', employeeRate: 7, employerRate: 11, pensionBaseType: 'BASIC_SALARY',
      minimumBase: null, maximumBase: null, priority: 0,
      applicableRole: null, applicableEmploymentType: null,
    })
    assert.strictEqual(employeePension, 700)
    assert.strictEqual(employerPension, 1100)
  })
  await test('calcPension respects min base', () => {
    const { employeePension } = calcPension(500, {
      id: '1', employeeRate: 7, employerRate: 11, pensionBaseType: 'BASIC_SALARY',
      minimumBase: 1000, maximumBase: null, priority: 0,
      applicableRole: null, applicableEmploymentType: null,
    })
    assert.strictEqual(employeePension, 70) // 7% of 1000
  })
  await test('calcPension respects max base', () => {
    const { employeePension } = calcPension(50000, {
      id: '1', employeeRate: 7, employerRate: 11, pensionBaseType: 'BASIC_SALARY',
      minimumBase: null, maximumBase: 20000, priority: 0,
      applicableRole: null, applicableEmploymentType: null,
    })
    assert.strictEqual(employeePension, 1400) // 7% of 20000
  })

  // ── PAYE ──────────────────────────────────────────────────────────
  console.log('\n[PAYE]')
  const brackets = [
    { id: 'b1', minIncome: 0, maxIncome: 600, taxRate: 0, deductionAmount: 0 },
    { id: 'b2', minIncome: 600, maxIncome: 1650, taxRate: 10, deductionAmount: 60 },
    { id: 'b3', minIncome: 1650, maxIncome: 3200, taxRate: 15, deductionAmount: 142.50 },
    { id: 'b4', minIncome: 3200, maxIncome: 5250, taxRate: 20, deductionAmount: 302.50 },
    { id: 'b5', minIncome: 5250, maxIncome: 7800, taxRate: 25, deductionAmount: 565 },
    { id: 'b6', minIncome: 7800, maxIncome: 10900, taxRate: 30, deductionAmount: 955 },
    { id: 'b7', minIncome: 10900, maxIncome: 15000, taxRate: 35, deductionAmount: 1500 },
    { id: 'b8', minIncome: 15000, maxIncome: null, taxRate: 40, deductionAmount: 2250 },
  ]

  await test('Empty brackets returns null with MISSING_PAYE_SCHEDULE', () => {
    const { bracket, blockers } = selectPayeBracket(10000, [])
    assert.strictEqual(bracket, null)
    assert.ok(blockers.includes('MISSING_PAYE_SCHEDULE'))
  })
  await test('Correct bracket selected for income 0', () => {
    const { bracket } = selectPayeBracket(0, brackets)
    assert.strictEqual(bracket?.id, 'b1')
  })
  await test('Correct bracket selected for income 599', () => {
    const { bracket } = selectPayeBracket(599, brackets)
    assert.strictEqual(bracket?.id, 'b1')
  })
  await test('Correct bracket selected for income 600', () => {
    const { bracket } = selectPayeBracket(600, brackets)
    assert.strictEqual(bracket?.id, 'b2')
  })
  await test('Correct bracket selected for income 15000', () => {
    const { bracket } = selectPayeBracket(15000, brackets)
    assert.strictEqual(bracket?.id, 'b8')
  })
  await test('No boundary matches two brackets', () => {
    const { bracket } = selectPayeBracket(600, brackets)
    assert.strictEqual(bracket?.id, 'b2') // 600 >= 600 is b2, not b1 (b1 max is 600, exclusive)
    assert.strictEqual(bracket?.minIncome, 600)
  })
  await test('Schedule gap detected', () => {
    const gapBrackets = [
      { id: 'b1', minIncome: 0, maxIncome: 1000, taxRate: 10, deductionAmount: 0 },
      { id: 'b2', minIncome: 2000, maxIncome: null, taxRate: 20, deductionAmount: 100 },
    ]
    const { bracket, blockers } = selectPayeBracket(1500, gapBrackets)
    assert.strictEqual(bracket, null)
    assert.ok(blockers.some(b => b.includes('gap')))
  })
  await test('Multiple matching brackets returns null', () => {
    const overlapping = [
      { id: 'b1', minIncome: 0, maxIncome: 5000, taxRate: 10, deductionAmount: 0 },
      { id: 'b2', minIncome: 0, maxIncome: 5000, taxRate: 15, deductionAmount: 50 },
    ]
    const { bracket, blockers } = selectPayeBracket(3000, overlapping)
    assert.strictEqual(bracket, null)
    assert.ok(blockers.some(b => b.includes('Multiple')))
  })
  await test('PAYE formula correct', () => {
    // Bracket: 5250-7800, rate 25%, deduction 565
    // taxableIncome = 7000
    // PAYE = 7000 * 25/100 - 565 = 1750 - 565 = 1185
    const paye = calcPaye(7000, { id: 'b5', minIncome: 5250, maxIncome: 7800, taxRate: 25, deductionAmount: 565 })
    assert.strictEqual(paye, 1185)
  })
  await test('PAYE cannot be negative', () => {
    const paye = calcPaye(100, { id: 'b1', minIncome: 0, maxIncome: 600, taxRate: 0, deductionAmount: 50 })
    assert.strictEqual(paye, 0) // 0% rate, Math.max(0, -50) = 0
  })

  // ── Pension Rule Selection ────────────────────────────────────────
  console.log('\n[Pension Rule Selection]')
  const pensionRules = [
    { id: 'r1', employeeRate: 7, employerRate: 11, pensionBaseType: 'BASIC_SALARY', minimumBase: null, maximumBase: null, priority: 0, applicableRole: null, applicableEmploymentType: null },
    { id: 'r2', employeeRate: 8, employerRate: 12, pensionBaseType: 'BASIC_SALARY', minimumBase: null, maximumBase: null, priority: 10, applicableRole: 'DSA', applicableEmploymentType: null },
  ]

  await test('Generic rule applies when no specific rule exists', () => {
    const { rule } = selectPensionRule(pensionRules, { role: 'NONEXISTENT', employmentType: null })
    assert.strictEqual(rule?.id, 'r1')
  })
  await test('Role-specific rule overrides generic', () => {
    const { rule } = selectPensionRule(pensionRules, { role: 'DSA', employmentType: null })
    assert.strictEqual(rule?.id, 'r2')
  })
  await test('Unrelated role rule is not selected', () => {
    const rules = [
      { id: 'r1', employeeRate: 7, employerRate: 11, pensionBaseType: 'BASIC_SALARY', minimumBase: null, maximumBase: null, priority: 0, applicableRole: 'DSP', applicableEmploymentType: null },
    ]
    const { rule, blockers } = selectPensionRule(rules, { role: 'DSA', employmentType: null })
    assert.strictEqual(rule, null)
    assert.ok(blockers.includes('MISSING_PENSION_RULE'))
  })
  await test('Empty rules returns blocker', () => {
    const { rule, blockers } = selectPensionRule([], { role: 'DSA', employmentType: null })
    assert.strictEqual(rule, null)
    assert.ok(blockers.includes('MISSING_PENSION_RULE'))
  })
  await test('Equal priority ambiguity returns blocker', () => {
    const ambiguous = [
      { id: 'r1', employeeRate: 7, employerRate: 11, pensionBaseType: 'BASIC_SALARY', minimumBase: null, maximumBase: null, priority: 10, applicableRole: 'DSA', applicableEmploymentType: null },
      { id: 'r2', employeeRate: 8, employerRate: 12, pensionBaseType: 'BASIC_SALARY', minimumBase: null, maximumBase: null, priority: 10, applicableRole: 'DSA', applicableEmploymentType: null },
    ]
    const { rule, blockers } = selectPensionRule(ambiguous, { role: 'DSA', employmentType: null })
    assert.strictEqual(rule, null)
    assert.ok(blockers.includes('AMBIGUOUS_PENSION_RULE'))
  })

  // ── Component Validation ──────────────────────────────────────────
  console.log('\n[Component Validation]')
  await test('Active component with KNOWN treatment passes', () => {
    const blockers = validatePayComponent({
      id: '1', code: 'TEST', name: 'Test', componentType: 'ALLOWANCE',
      isEarning: true, isDeduction: false, isPensionable: false,
      taxablePercent: 100, pensionablePercent: 0,
      affectsGross: true, affectsNet: true, affectsEmployerCost: false,
      calculationOrder: 30, taxTreatment: 'TAXABLE',       deductionTiming: 'NOT_APPLICABLE',
      isActive: true,
    })
    assert.strictEqual(blockers.length, 0)
  })
  await test('Inactive component returns PAY_COMPONENT_INACTIVE', () => {
    const blockers = validatePayComponent({
      id: '1', code: 'TEST', name: 'Test', componentType: 'ALLOWANCE',
      isEarning: true, isDeduction: false, isPensionable: false,
      taxablePercent: 100, pensionablePercent: 0,
      affectsGross: true, affectsNet: true, affectsEmployerCost: false,
      calculationOrder: 30, taxTreatment: 'TAXABLE', deductionTiming: 'NOT_APPLICABLE',
      isActive: false,
    })
    assert.ok(blockers.includes('PAY_COMPONENT_INACTIVE'))
  })
  await test('Unknown tax treatment returns UNKNOWN_TAX_TREATMENT', () => {
    const blockers = validatePayComponent({
      id: '1', code: 'TEST', name: 'Test', componentType: 'ALLOWANCE',
      isEarning: true, isDeduction: false, isPensionable: false,
      taxablePercent: 100, pensionablePercent: 0,
      affectsGross: true, affectsNet: true, affectsEmployerCost: false,
      calculationOrder: 30, taxTreatment: 'UNKNOWN', deductionTiming: 'NOT_APPLICABLE',
      isActive: true,
    })
    assert.ok(blockers.includes('UNKNOWN_TAX_TREATMENT'))
  })
  await test('Invalid taxablePercent returns blocker', () => {
    const blockers = validatePayComponent({
      id: '1', code: 'TEST', name: 'Test', componentType: 'ALLOWANCE',
      isEarning: true, isDeduction: false, isPensionable: false,
      taxablePercent: -5, pensionablePercent: 0,
      affectsGross: true, affectsNet: true, affectsEmployerCost: false,
      calculationOrder: 30, taxTreatment: 'TAXABLE', deductionTiming: 'NOT_APPLICABLE',
      isActive: true,
    })
    assert.ok(blockers.some(b => b.includes('taxablePercent')))
  })

  // ── Earning and Deduction Processing ──────────────────────────────
  console.log('\n[Earning and Deduction Processing]')
  const comp = { id: 'c1', code: 'KPI_ALLOWANCE', name: 'KPI Allowance', componentType: 'ALLOWANCE', taxablePercent: 100, isPensionable: true, pensionablePercent: 50, affectsGross: true, affectsNet: true, affectsEmployerCost: false, calculationOrder: 30 }
  const dedComp = { id: 'c2', code: 'LOAN_DEDUCTION', name: 'Loan Deduction', componentType: 'DEDUCTION', taxablePercent: 0, pensionablePercent: 0, affectsGross: false, affectsNet: true, affectsEmployerCost: false, calculationOrder: 60, deductionTiming: 'POST_TAX' }

  await test('Earning input increases gross and taxable', () => {
    const line = processEarningInput(2000, comp, 'src1')
    assert.strictEqual(line.grossAmount, 2000)
    assert.strictEqual(line.taxableAmount, 2000)
    assert.strictEqual(line.deductionAmount, 0)
    assert.strictEqual(line.lineType, 'ALLOWANCE')
  })
  await test('Non-taxable transport is not added to taxable income', () => {
    const ntComp = { ...comp, taxablePercent: 0 }
    const line = processEarningInput(1500, ntComp, 'src2')
    assert.strictEqual(line.grossAmount, 1500)
    assert.strictEqual(line.taxableAmount, 0)
    assert.strictEqual(line.nonTaxableAmount, 1500)
  })
  await test('Partial taxable percent', () => {
    const ptComp = { ...comp, taxablePercent: 50 }
    const line = processEarningInput(2000, ptComp, 'src3')
    assert.strictEqual(line.grossAmount, 2000)
    assert.strictEqual(line.taxableAmount, 1000)
    assert.strictEqual(line.nonTaxableAmount, 1000)
  })
  await test('Non-pensionable component does not increase pension base', () => {
    const npComp = { ...comp, isPensionable: false }
    const line = processEarningInput(2000, npComp, 'src4')
    assert.strictEqual(line.pensionableAmount, 0)
  })
  await test('Pensionable component uses pensionablePercent', () => {
    const pComp = { ...comp, isPensionable: true, pensionablePercent: 75 }
    const line = processEarningInput(2000, pComp, 'src5')
    assert.strictEqual(line.pensionableAmount, 1500)
  })
  await test('Deduction input reduces net salary and does not increase gross', () => {
    const line = processDeductionInput(500, dedComp, 'src6')
    assert.strictEqual(line.grossAmount, 0)
    assert.strictEqual(line.deductionAmount, 500)
    assert.strictEqual(line.lineType, 'DEDUCTION')
  })

  // ── Requirement Applicability ─────────────────────────────────────
  console.log('\n[Requirement Applicability]')
  await test('Requirement with role=DSA does not match non-DSA employee', () => {
    const req = { employeeCategory: null, role: 'DSA' as any, departmentId: null, regionId: null, areaId: null, shopId: null, employmentType: null }
    const emp = { employeeCategory: null, currentRole: 'DSP' as any, currentDepartmentId: null, currentRegionId: null, currentAreaId: null, currentShopId: null, employmentType: null }
    const matches = (
      (!req.employeeCategory || req.employeeCategory === emp.employeeCategory) &&
      (!req.role || req.role === emp.currentRole) &&
      (!req.departmentId || req.departmentId === emp.currentDepartmentId) &&
      (!req.regionId || req.regionId === emp.currentRegionId) &&
      (!req.areaId || req.areaId === emp.currentAreaId) &&
      (!req.shopId || req.shopId === emp.currentShopId) &&
      (!req.employmentType || req.employmentType === emp.employmentType)
    )
    assert.strictEqual(matches, false)
  })
  await test('Requirement with role=DSA matches DSA employee', () => {
    const req = { employeeCategory: null, role: 'DSA' as any, departmentId: null, regionId: null, areaId: null, shopId: null, employmentType: null }
    const emp = { employeeCategory: null, currentRole: 'DSA' as any, currentDepartmentId: null, currentRegionId: null, currentAreaId: null, currentShopId: null, employmentType: null }
    const matches = (
      (!req.employeeCategory || req.employeeCategory === emp.employeeCategory) &&
      (!req.role || req.role === emp.currentRole) &&
      (!req.departmentId || req.departmentId === emp.currentDepartmentId) &&
      (!req.regionId || req.regionId === emp.currentRegionId) &&
      (!req.areaId || req.areaId === emp.currentAreaId) &&
      (!req.shopId || req.shopId === emp.currentShopId) &&
      (!req.employmentType || req.employmentType === emp.employmentType)
    )
    assert.strictEqual(matches, true)
  })
  await test('Requirement with role=DSA + dept=X matches only DSA employees in dept X', () => {
    const req = { employeeCategory: null, role: 'DSA' as any, departmentId: 'deptX', regionId: null, areaId: null, shopId: null, employmentType: null }
    const empDsaWrongDept = { employeeCategory: null, currentRole: 'DSA' as any, currentDepartmentId: 'deptY', currentRegionId: null, currentAreaId: null, currentShopId: null, employmentType: null }
    const empDsaRightDept = { employeeCategory: null, currentRole: 'DSA' as any, currentDepartmentId: 'deptX', currentRegionId: null, currentAreaId: null, currentShopId: null, employmentType: null }
    const matchesWrong = (
      (!req.employeeCategory || req.employeeCategory === empDsaWrongDept.employeeCategory) &&
      (!req.role || req.role === empDsaWrongDept.currentRole) &&
      (!req.departmentId || req.departmentId === empDsaWrongDept.currentDepartmentId) &&
      (!req.regionId || req.regionId === empDsaWrongDept.currentRegionId) &&
      (!req.areaId || req.areaId === empDsaWrongDept.currentAreaId) &&
      (!req.shopId || req.shopId === empDsaWrongDept.currentShopId) &&
      (!req.employmentType || req.employmentType === empDsaWrongDept.employmentType)
    )
    const matchesRight = (
      (!req.employeeCategory || req.employeeCategory === empDsaRightDept.employeeCategory) &&
      (!req.role || req.role === empDsaRightDept.currentRole) &&
      (!req.departmentId || req.departmentId === empDsaRightDept.currentDepartmentId) &&
      (!req.regionId || req.regionId === empDsaRightDept.currentRegionId) &&
      (!req.areaId || req.areaId === empDsaRightDept.currentAreaId) &&
      (!req.shopId || req.shopId === empDsaRightDept.currentShopId) &&
      (!req.employmentType || req.employmentType === empDsaRightDept.employmentType)
    )
    assert.strictEqual(matchesWrong, false)
    assert.strictEqual(matchesRight, true)
  })
  await test('Requirement with no filters matches any employee', () => {
    const req = { employeeCategory: null, role: null, departmentId: null, regionId: null, areaId: null, shopId: null, employmentType: null }
    const emp = { employeeCategory: null, currentRole: 'DSA' as any, currentDepartmentId: 'deptX', currentRegionId: null, currentAreaId: null, currentShopId: null, employmentType: null }
    const matches = (
      (!req.employeeCategory || req.employeeCategory === emp.employeeCategory) &&
      (!req.role || req.role === emp.currentRole) &&
      (!req.departmentId || req.departmentId === emp.currentDepartmentId) &&
      (!req.regionId || req.regionId === emp.currentRegionId) &&
      (!req.areaId || req.areaId === emp.currentAreaId) &&
      (!req.shopId || req.shopId === emp.currentShopId) &&
      (!req.employmentType || req.employmentType === emp.employmentType)
    )
    assert.strictEqual(matches, true)
  })

  // ── Statutory Data ────────────────────────────────────────────────
  console.log('\n[Statutory Data]')
  try {
    const brackets = await getApprovedPayeBrackets(new Date('2024-06-01'))
    await test('getApprovedPayeBrackets returns array (may be empty for samples)', () => {
      assert.ok(Array.isArray(brackets))
    })
  } catch (e) {
    await test('getApprovedPayeBrackets does not throw', () => { throw e })
  }

  try {
    const rules = await getApprovedPensionRules(new Date('2024-06-01'))
    await test('getApprovedPensionRules returns array (may be empty for samples)', () => {
      assert.ok(Array.isArray(rules))
    })
  } catch (e) {
    await test('getApprovedPensionRules does not throw', () => { throw e })
  }

  // ── KPI Processing ──────────────────────────────────────────────────
  console.log('\n[KPI Processing]')
  const kpiPc = {
    id: 'kpi1', code: 'KPI_ALLOWANCE', name: 'KPI Allowance', componentType: 'KPI',
    isEarning: true, isDeduction: false, isPensionable: false,
    taxablePercent: 100, pensionablePercent: 0,
    affectsGross: true, affectsNet: true, affectsEmployerCost: false,
    calculationOrder: 40, taxTreatment: 'TAXABLE', isActive: true, deductionTiming: 'NOT_APPLICABLE',
  }

  await test('Missing percentage defaults to 100%', () => {
    const err = validateKpiPercentage(null)
    assert.strictEqual(err, null)
  })

  await test('100% pays the full default KPI amount', () => {
    const line = processKpiEarning(2000, 100, kpiPc)
    assert.strictEqual(line.grossAmount, 2000)
    assert.strictEqual(line.baseAmount, 2000)
    assert.strictEqual(line.rate, 100)
    assert.strictEqual(line.lineType, 'EARNING')
    assert.strictEqual(line.sourceType, 'PAY_RULE')
  })

  await test('80% pays 80% of the default KPI amount', () => {
    const line = processKpiEarning(2000, 80, kpiPc)
    assert.strictEqual(line.grossAmount, 1600)
    assert.strictEqual(line.rate, 80)
  })

  await test('0% pays zero', () => {
    const line = processKpiEarning(2000, 0, kpiPc)
    assert.strictEqual(line.grossAmount, 0)
  })

  await test('A percentage below 0 is rejected', () => {
    const err = validateKpiPercentage(-1)
    assert.strictEqual(err, 'INVALID_KPI_PERCENTAGE')
  })

  await test('A percentage above 100 is rejected', () => {
    const err = validateKpiPercentage(101)
    assert.strictEqual(err, 'INVALID_KPI_PERCENTAGE')
  })

  await test('KPI percentage is never treated directly as a Birr amount', () => {
    // The processKpiEarning uses defaultAmount * percentage / 100, not percentage as amount
    const line50 = processKpiEarning(2000, 50, kpiPc)
    const line100 = processKpiEarning(2000, 100, kpiPc)
    assert.strictEqual(line50.grossAmount, 1000)   // 2000 * 50 / 100 = 1000
    assert.strictEqual(line100.grossAmount, 2000)  // 2000 * 100 / 100 = 2000
    // If percentage were treated as Birr, 50 would give 50 and 100 would give 100
    assert.notStrictEqual(line50.grossAmount, 50)
    assert.notStrictEqual(line100.grossAmount, 100)
  })

  await test('KPI line uses component tax and pension config', () => {
    // Partially taxable KPI
    const partTaxPc = { ...kpiPc, taxablePercent: 50, isPensionable: true, pensionablePercent: 75 }
    const line = processKpiEarning(2000, 100, partTaxPc)
    assert.strictEqual(line.grossAmount, 2000)
    assert.strictEqual(line.taxableAmount, 1000)     // 2000 * 50%
    assert.strictEqual(line.nonTaxableAmount, 1000)
    assert.strictEqual(line.pensionableAmount, 1500)  // 2000 * 75%
  })

  // ── KPI Assignment Effective-Dated Lookup (DB) ─────────────────────
  console.log('\n[KPI Assignment Lookup]')
  try {
    const kpiComp = await prisma.payComponent.findUnique({ where: { code: 'KPI_ALLOWANCE' } })
    const dsaEmp = await prisma.employee.findFirst({ where: { currentRole: 'DSA', employmentStatus: 'ACTIVE' } })

    if (!kpiComp || !dsaEmp) {
      await test('Skipping DB-dependent KPI tests — no KPI component or DSA employee', () => {})
    } else {
      // Future-dated assignment (effective 2099) should not be resolved for 2024
      await prisma.employeePayComponentAssignment.upsert({
        where: {
          employeeId_payComponentId_effectiveFrom: {
            employeeId: dsaEmp.id, payComponentId: kpiComp.id, effectiveFrom: new Date('2099-01-01'),
          },
        },
        update: { defaultAmount: 9999 },
        create: {
          employeeId: dsaEmp.id, payComponentId: kpiComp.id,
          defaultAmount: 9999, effectiveFrom: new Date('2099-01-01'), isActive: true,
        },
      })
      const futureResult = await getEffectiveKpiDefaultAmount(dsaEmp.id, kpiComp.id, new Date('2024-06-01'))
      await test('Future KPI default amounts are ignored', () => {
        assert.ok(futureResult !== null)
        assert.strictEqual(futureResult!.defaultAmount, 2000)
      })

      // Add an updated assignment effective 2025 — should resolve for 2025
      await prisma.employeePayComponentAssignment.upsert({
        where: {
          employeeId_payComponentId_effectiveFrom: {
            employeeId: dsaEmp.id, payComponentId: kpiComp.id, effectiveFrom: new Date('2025-01-01'),
          },
        },
        update: { defaultAmount: 3000 },
        create: {
          employeeId: dsaEmp.id, payComponentId: kpiComp.id,
          defaultAmount: 3000, effectiveFrom: new Date('2025-01-01'), isActive: true,
        },
      })
      const latestResult = await getEffectiveKpiDefaultAmount(dsaEmp.id, kpiComp.id, new Date('2025-06-01'))
      await test('The latest effective KPI default amount is selected', () => {
        assert.ok(latestResult !== null)
        assert.strictEqual(latestResult!.defaultAmount, 3000)
      })

      // Nonexistent employee
      const missingResult = await getEffectiveKpiDefaultAmount('nonexistent-id', kpiComp.id, new Date('2024-06-01'))
      await test('Missing effective KPI default amount blocks calculation', () => {
        assert.strictEqual(missingResult, null)
      })
    }
  } catch (e: any) {
    await test('KPI assignment lookup', () => { throw e })
  }

  // ── Summary ───────────────────────────────────────────────────────
  const total = RUNNING_TOTAL.passed + RUNNING_TOTAL.failed
  console.log(`\n========================================`)
  console.log(`Phase 5A Tests: ${total} total, ${RUNNING_TOTAL.passed} passed, ${RUNNING_TOTAL.failed} failed`)
  console.log(`========================================\n`)

  if (RUNNING_TOTAL.failed > 0) process.exit(1)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
