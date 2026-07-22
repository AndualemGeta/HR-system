import { prisma } from '../lib/prisma'

let passed = 0
let failed = 0
const errors: string[] = []

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
  console.log('\n=== MVP Employee Tests ===\n')

  // ── Employee Creation ──────────────────────────────
  console.log('[Employee Creation]')
  await assert('Employee model exists', async () => {
    const count = await prisma.employee.count()
    return typeof count === 'number'
  })

  await assert('Employee can have basic salary', async () => {
    const emp = await prisma.employee.findFirst({ where: { basicSalary: { not: null } } })
    return emp !== null
  })

  await assert('EmployeePayrollProfile exists', async () => {
    const count = await prisma.employeePayrollProfile.count()
    return typeof count === 'number'
  })

  await assert('EmployeeSalary history exists', async () => {
    const count = await prisma.employeeSalary.count()
    return typeof count === 'number'
  })

  await assert('EmployeeStatusHistory exists', async () => {
    const count = await prisma.employeeStatusHistory.count()
    return typeof count === 'number'
  })

  // ── Organization ──────────────────────────────
  console.log('[Organization]')
  await assert('Departments exist', async () => {
    const count = await prisma.department.count()
    return count > 0
  })

  await assert('Locations exist', async () => {
    const count = await prisma.location.count()
    return count > 0
  })

  // ── Audit ──────────────────────────────
  console.log('[Audit]')
  await assert('AuditLog stores employee actions', async () => {
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
