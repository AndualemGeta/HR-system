import { prisma } from '../lib/prisma'

let passed = 0
let failed = 0

async function assert(label: string, fn: () => Promise<boolean>) {
  try {
    const result = await fn()
    if (result) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; console.log(`  \u2717 ${label}`) }
  } catch (e) {
    failed++; console.log(`  \u2717 ${label}: ${e instanceof Error ? e.message : e}`)
  }
}

async function main() {
  console.log('\n=== MVP Employee Tests ===\n')

  // ── Employee Records ──
  console.log('[Employee Records]')
  await assert('Employees exist in the database', async () => {
    const count = await prisma.employee.count()
    return count > 0
  })

  await assert('Employees have basic salary records', async () => {
    const count = await prisma.employee.count({ where: { basicSalary: { not: null } } })
    return count > 0
  })

  await assert('Employees have hire dates (for pension eligibility)', async () => {
    const count = await prisma.employee.count({ where: { hireDate: { not: null } } })
    return count > 0
  })

  await assert('EmployeePayrollProfile table exists', async () => {
    const count = await prisma.employeePayrollProfile.count()
    return typeof count === 'number'
  })

  await assert('EmployeeSalary history table exists', async () => {
    const count = await prisma.employeeSalary.count()
    return typeof count === 'number'
  })

  await assert('EmployeeStatusHistory table exists', async () => {
    const count = await prisma.employeeStatusHistory.count()
    return typeof count === 'number'
  })

  // ── Organization ──
  console.log('[Organization]')
  await assert('Departments exist', async () => {
    const count = await prisma.department.count()
    return count > 0
  })

  await assert('Locations exist', async () => {
    const count = await prisma.location.count()
    return count > 0
  })

  // ── Payroll Profile Fields ──
  console.log('[Payroll Profile]')
  await assert('Payroll profiles have payment method', async () => {
    const profiles = await prisma.employeePayrollProfile.findMany({ take: 5 })
    if (profiles.length === 0) return true
    return profiles.some(p => p.paymentMethod !== null)
  })

  await assert('Payroll profiles have bank details or M-PESA', async () => {
    const profiles = await prisma.employeePayrollProfile.findMany({ take: 10 })
    if (profiles.length === 0) return true
    return profiles.some(p => p.bankName || p.bankAccountNumber || p.mpesaAccount)
  })

  await assert('Payroll profiles have tax ID and pension ID', async () => {
    const profiles = await prisma.employeePayrollProfile.findMany({ take: 10 })
    if (profiles.length === 0) return true
    return profiles.some(p => p.taxId || p.pensionId)
  })

  // ── Employee ID Resolution ──
  console.log('[Department/Location Resolution]')
  await assert('Employee department IDs resolve to department names', async () => {
    const emp = await prisma.employee.findFirst({ where: { currentDepartmentId: { not: null } } })
    if (!emp || !emp.currentDepartmentId) return true
    const dept = await prisma.department.findUnique({ where: { id: emp.currentDepartmentId } })
    return dept !== null && dept.name.length > 0
  })

  await assert('Employee shop IDs resolve to location names', async () => {
    const emp = await prisma.employee.findFirst({ where: { currentShopId: { not: null } } })
    if (!emp || !emp.currentShopId) return true
    const loc = await prisma.location.findUnique({ where: { id: emp.currentShopId } })
    return loc !== null && loc.name.length > 0
  })

  // ── Audit ──
  console.log('[Audit]')
  await assert('AuditLog stores employee-related actions', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Employee' },
      take: 1,
    })
    return logs.length > 0
  })

  console.log(`\n${'='.repeat(40)}`)
  console.log(`MVP Employee Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
