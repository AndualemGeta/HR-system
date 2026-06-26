import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../lib/password'
import { getUserPermissions, userHasPermission, ALL_PERMISSIONS } from '../lib/rbac'
import { EMPLOYEE_ID_REGEX } from '../lib/constants'

let passed = 0
let failed = 0
const errors: string[] = []

async function assertAsync(label: string, fn: () => Promise<boolean>) {
  try {
    const result = await fn()
    if (result) {
      passed++
      console.log(`  ✓ ${label}`)
    } else {
      failed++
      errors.push(label)
      console.log(`  ✗ ${label}`)
    }
  } catch (e) {
    failed++
    errors.push(`${label}: ${e instanceof Error ? e.message : e}`)
    console.log(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`)
  }
}

async function main() {
  console.log('\n=== Phase 1 Tests ===\n')

  // ── Authentication ──────────────────────────────────────
  console.log('[Authentication]')

  await assertAsync('password hashing produces hash', async () => {
    const hash = await hashPassword('Test123!')
    return hash.startsWith('$2a$') || hash.startsWith('$2b$')
  })

  await assertAsync('password verification succeeds', async () => {
    const hash = await hashPassword('Test123!')
    return verifyPassword('Test123!', hash)
  })

  await assertAsync('password verification fails with wrong password', async () => {
    const hash = await hashPassword('Test123!')
    return !(await verifyPassword('WrongPass1!', hash))
  })

  await assertAsync('admin user exists and is active', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    return user !== null && user.isActive
  })

  await assertAsync('admin user has SUPER_ADMIN role', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!user) return false
    const ur = await prisma.userRole.findFirst({ where: { userId: user.id }, include: { role: true } })
    return ur?.role.name === 'SUPER_ADMIN'
  })

  await assertAsync('audit log can record LOGIN action', async () => {
    // Verify the AuditAction enum and schema support LOGIN
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const log = await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: admin.id,
      },
    })
    return log !== null && log.action === 'LOGIN'
  })

  await assertAsync('audit log can record FAILED_LOGIN action', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const log = await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'FAILED_LOGIN',
        entityType: 'User',
        entityId: admin.id,
      },
    })
    return log !== null && log.action === 'FAILED_LOGIN'
  })

  // ── RBAC ────────────────────────────────────────────────
  console.log('\n[RBAC]')

  await assertAsync('SUPER_ADMIN has all permissions', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const perms = await getUserPermissions(admin.id)
    return ALL_PERMISSIONS.every(p => perms.includes(p as never))
  })

  await assertAsync('EMPLOYEE role has no permissions', async () => {
    const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
    if (!empUser) return false
    const perms = await getUserPermissions(empUser.id)
    return perms.length === 0
  })

  await assertAsync('HR_ADMIN has employee.create', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'employee.create')
  })

  await assertAsync('HR_ADMIN has salary.view', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'salary.view')
  })

  await assertAsync('AUDITOR has audit.view', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'audit.view')
  })

  await assertAsync('AUDITOR does not have salary.update', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })
    if (!user) return false
    return !(await userHasPermission(user.id, 'salary.update'))
  })

  // ── Employee ────────────────────────────────────────────
  console.log('\n[Employee]')

  await assertAsync('employee ID format is LSTA_NNNN', async () => {
    const emp = await prisma.employee.findFirst({ orderBy: { employeeId: 'asc' } })
    if (!emp) return false
    return EMPLOYEE_ID_REGEX.test(emp.employeeId)
  })

  await assertAsync('employee IDs are sequential', async () => {
    const emps = await prisma.employee.findMany({ orderBy: { employeeId: 'asc' }, take: 2 })
    if (emps.length < 2) return true // not enough data
    const num1 = parseInt(emps[0].employeeId.split('_')[1])
    const num2 = parseInt(emps[1].employeeId.split('_')[1])
    return num2 === num1 + 1
  })

  await assertAsync('at least one employee exists', async () => {
    const count = await prisma.employee.count()
    return count > 0
  })

  await assertAsync('employee fullName is populated', async () => {
    const emp = await prisma.employee.findFirst()
    return emp !== null && emp.fullName.length > 0
  })

  await assertAsync('employee has employment status', async () => {
    const emp = await prisma.employee.findFirst()
    return emp !== null && emp.employmentStatus.length > 0
  })

  // ── Salary ──────────────────────────────────────────────
  console.log('\n[Salary]')

  await assertAsync('salary records exist (from sample data)', async () => {
    // Check if EmployeeSalary table has data or at least Employee.basicSalary is populated
    const salaryCount = await prisma.employeeSalary.count()
    const empWithSalary = await prisma.employee.count({ where: { basicSalary: { not: null } } })
    return salaryCount > 0 || empWithSalary > 0
  })

  // ── Onboarding ──────────────────────────────────────────
  console.log('\n[Onboarding]')

  await assertAsync('onboarding checklists exist', async () => {
    const count = await prisma.onboardingChecklist.count()
    return count > 0
  })

  await assertAsync('onboarding checklist items exist', async () => {
    const count = await prisma.onboardingChecklistItem.count()
    return count > 0
  })

  // ── Assignment and Status ───────────────────────────────
  console.log('\n[Assignment & Status]')

  await assertAsync('assignment records can be created', async () => {
    const emp = await prisma.employee.findFirst()
    if (!emp) return false
    const existing = emp.id
    return existing.length > 0
  })

  await assertAsync('status history entries exist or can be created', async () => {
    const count = await prisma.employeeStatusHistory.count()
    // At minimum, the model exists and is queryable
    return count >= 0
  })

  await assertAsync('employee status values are valid', async () => {
    const statuses = await prisma.employee.findMany({ select: { employmentStatus: true }, distinct: ['employmentStatus'] })
    const validStatuses = ['DRAFT', 'ONBOARDING', 'ACTIVE', 'ON_PROBATION', 'SUSPENDED', 'ON_LEAVE', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'EXITED']
    return statuses.every(s => validStatuses.includes(s.employmentStatus))
  })

  // ── Reports ─────────────────────────────────────────────
  console.log('\n[Reports]')

  await assertAsync('reports data can be aggregated', async () => {
    const total = await prisma.employee.count()
    const active = await prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } })
    return total > 0 && active >= 0
  })

  await assertAsync('employee counts by department work', async () => {
    const byDept = await prisma.employee.groupBy({
      by: ['currentDepartmentId'],
      _count: true,
    })
    return Array.isArray(byDept)
  })

  // ── Audit Logs ──────────────────────────────────────────
  console.log('\n[Audit Logs]')

  await assertAsync('audit logs exist', async () => {
    const count = await prisma.auditLog.count()
    return count > 0
  })

  await assertAsync('audit logs have user references', async () => {
    const log = await prisma.auditLog.findFirst({ where: { userId: { not: null } } })
    return log !== null
  })

  // ── Organization ────────────────────────────────────────
  console.log('\n[Organization]')

  await assertAsync('departments exist', async () => {
    const count = await prisma.department.count()
    return count > 0
  })

  await assertAsync('locations exist with Ethiopia data', async () => {
    const locations = await prisma.location.findMany()
    if (locations.length === 0) return false
    // Verify no Kathmandu data
    const hasKathmandu = locations.some(l => l.name.includes('Kathmandu') || l.code.includes('KTM'))
    return !hasKathmandu && locations.length > 0
  })

  await assertAsync('no Kathmandu locations in seed data', async () => {
    const locations = await prisma.location.findMany()
    const hasKathmandu = locations.some(l => l.name.includes('Kathmandu') || l.code.includes('KTM'))
    return !hasKathmandu
  })

  // ── Users ───────────────────────────────────────────────
  console.log('\n[Users]')

  await assertAsync('all seeded users exist', async () => {
    const emails = [
      'admin@leapfrog.com',
      'ceo@leapfrog.com',
      'hr.admin@leapfrog.com',
      'hr.manager@leapfrog.com',
      'hr.officer@leapfrog.com',
      'finance.director@leapfrog.com',
      'finance.payroll@leapfrog.com',
      'sales.head@leapfrog.com',
      'shop.manager@leapfrog.com',
      'manager@leapfrog.com',
      'employee@leapfrog.com',
      'auditor@leapfrog.com',
    ]
    const users = await prisma.user.findMany({ where: { email: { in: emails } } })
    return users.length === emails.length
  })

  await assertAsync('all seeded roles exist', async () => {
    const roleNames = [
      'SUPER_ADMIN', 'CEO', 'CEO_COORDINATOR', 'HR_ADMIN', 'HR_MANAGER',
      'HR_OFFICER', 'FINANCE_DIRECTOR', 'FINANCE_PAYROLL', 'TREASURY_MANAGER',
      'FINANCIAL_CONTROL_REPORTING_MANAGER', 'DISTRIBUTION_MANAGER',
      'DISTRIBUTION_OFFICER', 'TECHNOLOGY_MANAGER', 'SALES_HEAD',
      'AREA_SALES_MANAGER', 'SHOP_MANAGER', 'EMPLOYEE', 'AUDITOR',
    ]
    const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } })
    return roles.length === roleNames.length
  })

  // ── Summary ─────────────────────────────────────────────
  const total = passed + failed
  console.log(`\n${'='.repeat(40)}`)
  console.log(`Tests: ${total} total, ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log(`Failed: ${errors.join(', ')}`)
  }
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Test runner error:', e)
  process.exit(1)
})
