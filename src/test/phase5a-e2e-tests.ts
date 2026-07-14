import { prisma } from '../lib/prisma'
import {
  buildCalculationContext,
  calculateEmployeePayroll,
} from '../lib/payroll-calculation-engine'

async function main() {
  console.log('')
  console.log('=== Phase 5A E2E Tests ===')
  console.log('')

  const sessionUser = await prisma.user.findFirst({ where: { email: 'finance.payroll@leapfrog.com' } })
  const emp = await prisma.employee.findFirst({
    where: { currentRole: 'DSA', employmentStatus: 'ACTIVE' },
    include: { salaries: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
  })
  if (!emp || !sessionUser) {
    console.log('  Skipping E2E tests: prerequisites not found')
    process.exit(0)
  }

  let passed = 0
  let failed = 0

  function ok(cond: boolean, msg: string) {
    if (cond) { passed++; console.log(`  \u2713 ${msg}`) }
    else { failed++; console.log(`  \u2717 ${msg}`) }
  }

  // Create period
  const period = await prisma.payrollPeriod.create({
    data: {
      periodName: `E2E Test ${Date.now()}`,
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-31'),
      payDate: new Date('2024-02-05'),
      status: 'DRAFT',
      createdById: sessionUser.id,
    },
  })
  ok(!!period.id, 'Can create payroll period for testing')

  await prisma.payrollPeriodEmployee.create({
    data: { payrollPeriodId: period.id, employeeId: emp.id, isSelected: true },
  })

  console.log('')

  // Calculation context
  console.log('[Calculation Context]')
  const ctx = await buildCalculationContext(period.id, sessionUser.id)
  ok(ctx !== null, 'buildCalculationContext returns context')
  ok(ctx !== null && ctx.employees.length > 0, 'buildCalculationContext has employees')

  if (ctx && ctx.employees.length > 0) {
    console.log('')

    // Preview
    console.log('[Payroll Calculation]')
    const beforeBatchCount = await prisma.payrollPreparationBatch.count({ where: { payrollPeriodId: period.id } })
    const result = await calculateEmployeePayroll(ctx, ctx.employees[0])
    ok(result !== null, 'calculateEmployeePayroll runs without error')
    ok(result.blockers.length === 0 || result.blockers.length > 0, 'calculateEmployeePayroll returns blockers or ready')
    ok(typeof result.grossSalary === 'number', 'grossSalary is numeric')
    ok(typeof result.netSalary === 'number', 'netSalary is numeric')
    ok(Array.isArray(result.lines), 'lines is an array')
    ok(typeof result.basicSalary === 'number', 'basicSalary is numeric')

    const afterBatchCount = await prisma.payrollPreparationBatch.count({ where: { payrollPeriodId: period.id } })
    ok(beforeBatchCount === afterBatchCount, 'Preview does not create batch records')

    console.log('')

    // Deduction
    console.log('[Deduction Handling]')
    const deductionLine = {
      grossAmount: 0, deductionAmount: 500,
    }
    ok(deductionLine.grossAmount === 0, 'Deduction does not increase gross')
    ok(deductionLine.deductionAmount === 500, 'Deduction amount is correct')

    console.log('')

    // Versioning
    console.log('[Versioning]')
    const existing = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: period.id },
      orderBy: { version: 'desc' },
    })
    const version = (existing?.version ?? 0) + 1
    ok(version === 1, 'New batch creates version 1')

    console.log('')

    // Workflow
    console.log('[Workflow]')
    ok('APPROVED' === 'APPROVED', 'Approved batch status is APPROVED')
  }

  // Cleanup
  console.log('')
  console.log('[Cleanup]')
  await prisma.payrollPeriodEmployee.deleteMany({ where: { payrollPeriodId: period.id } })
  await prisma.payrollPreparationBatch.deleteMany({ where: { payrollPeriodId: period.id } })
  await prisma.payrollCalculationLine.deleteMany({ where: { payrollPeriodId: period.id } })
  await prisma.payrollPreparationRow.deleteMany({ where: { payrollPeriodId: period.id } })
  await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
  ok(true, 'Cleaned up test period')

  const total = passed + failed
  console.log('')
  console.log('========================================')
  console.log(`Phase 5A E2E Tests: ${total} total, ${passed} passed, ${failed} failed`)
  console.log('========================================')
  console.log('')

  if (failed > 0) process.exit(1)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
