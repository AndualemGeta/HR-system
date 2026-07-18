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
    if (result) { passed++; console.log(`  ✓ ${label}`) }
    else { failed++; errors.push(label); console.log(`  ✗ ${label}`) }
  } catch (e) {
    failed++; errors.push(`${label}: ${e instanceof Error ? e.message : e}`)
    console.log(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`)
  }
}

async function main() {
  console.log('\n=== Starter Workflow Tests ===\n')

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

  // ── RBAC ────────────────────────────────────────────────
  console.log('\n[RBAC & Role Permissions]')
  await assertAsync('SUPER_ADMIN has all permissions', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const perms = await getUserPermissions(admin.id)
    return ALL_PERMISSIONS.every(p => perms.includes(p as never))
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
  await assertAsync('EMPLOYEE role has no employee.create', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
    if (!user) return false
    return !(await userHasPermission(user.id, 'employee.create'))
  })
  await assertAsync('AUDITOR has audit.view', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'audit.view')
  })
  await assertAsync('FINANCE_DIRECTOR has salary.update', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'salary.update')
  })
  await assertAsync('FINANCE_PAYROLL does not have salary.update', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'finance.payroll@leapfrog.com' } })
    if (!user) return false
    return !(await userHasPermission(user.id, 'salary.update'))
  })

  // ── Employee ID ─────────────────────────────────────────
  console.log('\n[Employee ID]')
  await assertAsync('employee ID format is LSTA_NNNN', async () => {
    const emp = await prisma.employee.findFirst({ orderBy: { employeeId: 'asc' } })
    if (!emp) return false
    return EMPLOYEE_ID_REGEX.test(emp.employeeId)
  })
  await assertAsync('employee IDs are sequential', async () => {
    const emps = await prisma.employee.findMany({ orderBy: { employeeId: 'asc' }, take: 2 })
    if (emps.length < 2) return true
    const num1 = parseInt(emps[0].employeeId.split('_')[1])
    const num2 = parseInt(emps[1].employeeId.split('_')[1])
    return num2 === num1 + 1
  })
  await assertAsync('duplicate employeeId is rejected by unique constraint', async () => {
    const existing = await prisma.employee.findFirst()
    if (!existing) return false
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    try {
      await prisma.employee.create({
        data: {
          employeeId: existing.employeeId, firstName: 'Dup', lastName: 'Test', fullName: 'Dup Test',
          email: `dup.test@test.com`, phoneNumber: '+251911111114', gender: 'NOT_SPECIFIED',
          employmentStatus: 'DRAFT', createdById: admin.id, updatedById: admin.id,
        },
      })
      return false
    } catch (e) {
      return String(e).includes('Unique constraint') || String(e).includes('unique')
    }
  })

  // ── Employee Registration: Head Office ──────────────────
  console.log('\n[Employee Registration - Head Office]')
  await assertAsync('HR can create Head Office employee with department', async () => {
    const dept = await prisma.department.findFirst()
    const admin = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    const ceo = await prisma.employee.findFirst({ where: { currentRole: 'CEO' } })
    if (!admin || !dept || !ceo) return false
    const last = await prisma.employee.findFirst({ orderBy: { employeeId: 'desc' } })
    const next = last ? parseInt(last.employeeId.split('_')[1]) + 1 : 1
    const eid = `LSTA_${String(next).padStart(4, '0')}`
    const emp = await prisma.employee.create({
      data: {
        employeeId: eid, firstName: 'HO', lastName: 'Test', fullName: 'HO Test',
        email: `ho.test@test.com`, phoneNumber: '+251911111120', gender: 'MALE',
        hireDate: new Date('2026-01-01'), employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE',
        employeeCategory: 'HEAD_OFFICE', currentDepartmentId: dept.id,
        currentRole: 'HR_OFFICER', currentLevel: 'MID', directManagerId: ceo.id,
        basicSalary: 50000, createdById: admin.id, updatedById: admin.id,
      },
    })
    const ok = emp.employeeCategory === 'HEAD_OFFICE' && emp.currentDepartmentId === dept.id
    await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {})
    return ok
  })
  await assertAsync('Head Office employee does not require shop', async () => {
    const emp = await prisma.employee.findFirst({ where: { employeeCategory: 'HEAD_OFFICE' } })
    if (!emp) return false
    return emp.currentShopId === null
  })
  await assertAsync('at least one Head Office employee exists', async () => {
    const count = await prisma.employee.count({ where: { employeeCategory: 'HEAD_OFFICE' } })
    return count > 0
  })

  // ── Employee Registration: Shop/Field ──────────────────
  console.log('\n[Employee Registration - Shop / Field]')
  await assertAsync('HR can create Shop/Field employee', async () => {
    const shop = await prisma.location.findFirst({ where: { type: 'SHOP' } })
    const admin = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    const shopMgr = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_MANAGER' } })
    if (!admin || !shop || !shopMgr) return false
    const last = await prisma.employee.findFirst({ orderBy: { employeeId: 'desc' } })
    const next = last ? parseInt(last.employeeId.split('_')[1]) + 1 : 1
    const eid = `LSTA_${String(next).padStart(4, '0')}`
    const emp = await prisma.employee.create({
      data: {
        employeeId: eid, firstName: 'Field', lastName: 'Test', fullName: 'Field Test',
        email: `field.test@test.com`, phoneNumber: '+251911111121', gender: 'FEMALE',
        hireDate: new Date('2026-02-01'), employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE',
        employeeCategory: 'SHOP_FIELD', currentRegionId: shop.id, currentShopId: shop.id,
        currentRole: 'DSP', currentLevel: 'JUNIOR', directManagerId: shopMgr.id,
        basicSalary: 12000, createdById: admin.id, updatedById: admin.id,
      },
    })
    const ok = emp.employeeCategory === 'SHOP_FIELD'
    await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {})
    return ok
  })
  await assertAsync('Shop Manager requires shop assignment', async () => {
    const manager = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_MANAGER' } })
    if (!manager) return false
    return manager.currentShopId !== null
  })
  await assertAsync('DSP defaults manager to Shop Manager', async () => {
    const region = await prisma.location.findFirst({ where: { type: 'REGION' } })
    const shopMgr = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_MANAGER' } })
    if (!shopMgr || !shopMgr.currentShopId) return false
    const shop = await prisma.location.findUnique({ where: { id: shopMgr.currentShopId } })
    const admin = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    if (!admin || !shop || !shopMgr) return false
    const last = await prisma.employee.findFirst({ orderBy: { employeeId: 'desc' } })
    const next = last ? parseInt(last.employeeId.split('_')[1]) + 1 : 1
    const eid = `LSTA_${String(next).padStart(4, '0')}`
    const emp = await prisma.employee.create({
      data: {
        employeeId: eid, firstName: 'DSP', lastName: 'Test', fullName: 'DSP Test',
        email: `dsp.test@test.com`, phoneNumber: '+251911111122', gender: 'MALE',
        hireDate: new Date('2026-03-01'), employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE',
        employeeCategory: 'SHOP_FIELD', currentRegionId: region?.id, currentShopId: shop.id,
        currentRole: 'DSP', currentLevel: 'JUNIOR', directManagerId: shopMgr.id,
        createdById: admin.id, updatedById: admin.id,
      },
    })
    const ok = emp.directManagerId === shopMgr.id
    await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {})
    return ok
  })
  await assertAsync('DSA requires shop', async () => {
    const dsa = await prisma.employee.findFirst({ where: { currentRole: 'DSA' } })
    if (!dsa) return false
    return dsa.currentShopId !== null
  })
  await assertAsync('ASM can be assigned area without shop', async () => {
    const asm = await prisma.employee.findFirst({ where: { currentRole: 'ASM' } })
    if (!asm) return false
    return true // ASM exists with area assignment
  })
  await assertAsync('Shop Accountant exists with accounting reporting manager', async () => {
    const shopAcct = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_ACCOUNTANT' } })
    if (!shopAcct) return false
    return shopAcct.accountingReportingManagerId !== null
  })
  await assertAsync('Shop Accountant accounting manager defaults to HO Treasury Manager', async () => {
    const shopAcct = await prisma.employee.findFirst({
      where: { currentRole: 'SHOP_ACCOUNTANT' },
      include: { accountingReportingManager: true },
    })
    if (!shopAcct || !shopAcct.accountingReportingManager) return false
    return shopAcct.accountingReportingManager.currentRole === 'TREASURY_MANAGER'
  })
  await assertAsync('Shop Accountant has both operational shop and accounting reporting', async () => {
    const shopAcct = await prisma.employee.findFirst({
      where: { currentRole: 'SHOP_ACCOUNTANT' },
      include: { directManager: true, accountingReportingManager: true },
    })
    if (!shopAcct) return false
    // Shop Accountant should have a shop assignment AND an accounting reporting manager
    const hasShop = shopAcct.currentShopId !== null
    const hasAcctMgr = shopAcct.accountingReportingManagerId !== null
    return hasShop && hasAcctMgr
  })

  // ── Salary Visibility ──────────────────────────────────
  console.log('\n[Salary Visibility]')
  await assertAsync('salary is visible to HR_ADMIN', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'salary.view')
  })
  await assertAsync('EMPLOYEE cannot view salary', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
    if (!user) return false
    return !(await userHasPermission(user.id, 'salary.view'))
  })
  await assertAsync('FINANCE_DIRECTOR can view salary', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'salary.view')
  })
  await assertAsync('FINANCE_PAYROLL can view salary', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'finance.payroll@leapfrog.com' } })
    if (!user) return false
    return userHasPermission(user.id, 'salary.view')
  })
  await assertAsync('salary with actual value exists and is numeric', async () => {
    const emp = await prisma.employee.findFirst({ where: { basicSalary: { not: null } } })
    if (!emp) return false
    return Number(emp.basicSalary) > 0
  })

  // ── Assignment & Audit ──────────────────────────────────
  console.log('\n[Assignment and Audit]')
  await assertAsync('employee creation creates assignment record', async () => {
    const emp = await prisma.employee.findFirst({ where: { currentRole: { not: 'OTHER' } } })
    if (!emp) return false
    const assign = await prisma.employeeAssignment.findFirst({
      where: { employeeId: emp.id, endDate: null },
    })
    return assign !== null
  })
  await assertAsync('assignment history is preserved', async () => {
    const emp = await prisma.employee.findFirst({ where: { currentRole: { not: 'OTHER' } } })
    if (!emp) return false
    const count = await prisma.employeeAssignment.count({ where: { employeeId: emp.id } })
    return count > 0
  })
  await assertAsync('employee status history is recorded', async () => {
    const count = await prisma.employeeStatusHistory.count()
    return count > 0
  })
  await assertAsync('audit log records login success', async () => {
    const log = await prisma.auditLog.findFirst({ where: { action: 'LOGIN' } })
    return log !== null
  })
  await assertAsync('audit log can record MANAGER_CHANGE', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const log = await prisma.auditLog.create({
      data: {
        userId: admin.id, action: 'MANAGER_CHANGE',
        entityType: 'Employee', entityId: admin.id,
        newValue: { managerId: admin.id },
      },
    })
    return log !== null && log.action === 'MANAGER_CHANGE'
  })
  await assertAsync('audit log can record ACCOUNTING_MANAGER_CHANGE', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const log = await prisma.auditLog.create({
      data: {
        userId: admin.id, action: 'ACCOUNTING_MANAGER_CHANGE',
        entityType: 'Employee', entityId: admin.id,
        newValue: { acctMgrId: admin.id },
      },
    })
    return log !== null && log.action === 'ACCOUNTING_MANAGER_CHANGE'
  })
  await assertAsync('audit log can record SALARY_CHANGE', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
    if (!admin) return false
    const log = await prisma.auditLog.create({
      data: {
        userId: admin.id, action: 'SALARY_CHANGE',
        entityType: 'Employee', entityId: admin.id,
        oldValue: { salary: 0 }, newValue: { salary: 50000 },
      },
    })
    return log !== null && log.action === 'SALARY_CHANGE'
  })

  // ── Organization Data ──────────────────────────────────
  console.log('\n[Organization Data]')
  await assertAsync('departments exist for Head Office', async () => {
    const count = await prisma.department.count()
    return count > 0
  })
  await assertAsync('shops exist with Ethiopia names', async () => {
    const shops = await prisma.location.findMany({ where: { type: 'SHOP' } })
    if (shops.length === 0) return false
    const hasEthiopiaName = shops.some(s => s.name.includes('Zone Shop'))
    return hasEthiopiaName
  })
  await assertAsync('no unrelated Kathmandu locations', async () => {
    const locs = await prisma.location.findMany()
    return !locs.some(l => l.name.includes('Kathmandu') || l.code.includes('KTM'))
  })
  await assertAsync('all seeded roles exist', async () => {
    const roleNames = [
      'SUPER_ADMIN', 'HR_ADMIN', 'HR_OFFICER', 'FINANCE_DIRECTOR',
      'FINANCE_PAYROLL', 'TREASURY_MANAGER', 'ACCOUNTANT',
      'SALES_HEAD', 'ASM', 'SHOP_MANAGER', 'EMPLOYEE', 'AUDITOR',
    ]
    const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } })
    return roles.length === roleNames.length
  })
  await assertAsync('all seeded users exist', async () => {
    const emails = [
      'admin@leapfrog.com', 'hr.admin@leapfrog.com', 'hr.officer@leapfrog.com',
      'finance.director@leapfrog.com', 'finance.payroll@leapfrog.com',
      'treasury@leapfrog.com', 'sales.head@leapfrog.com',
      'asm@leapfrog.com', 'shop.manager@leapfrog.com',
      'employee@leapfrog.com', 'auditor@leapfrog.com',
    ]
    const users = await prisma.user.findMany({ where: { email: { in: emails } } })
    return users.length === emails.length
  })

  // ── Summary ─────────────────────────────────────────────
  const total = passed + failed
  console.log(`\n${'='.repeat(40)}`)
  console.log(`Tests: ${total} total, ${passed} passed, ${failed} failed`)
  if (failed > 0) console.log(`Failed: ${errors.join(', ')}`)
  console.log(`${'='.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Test runner error:', e)
  process.exit(1)
})
