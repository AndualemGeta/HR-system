import { PrismaClient, EmployeeRole, EmployeeLevel, LocationType, EmploymentType, EmploymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ALL_PERMISSIONS = [
  'employee.view', 'employee.create', 'employee.update', 'employee.delete',
  'salary.view', 'salary.update',
  'status.view', 'status.update',
  'assignment.view', 'assignment.update',
  'onboarding.view', 'onboarding.update',
  'reports.view',
  'audit.view',
  'user.view', 'user.manage',
  'role.view', 'role.manage',
  'organization.view', 'organization.manage',
] as const

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  CEO: [
    'employee.view', 'reports.view', 'organization.view',
  ],
  CEO_COORDINATOR: [
    'employee.view', 'status.view', 'reports.view', 'organization.view',
  ],
  HR_ADMIN: [
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'salary.view', 'salary.update',
    'status.view', 'status.update',
    'assignment.view', 'assignment.update',
    'onboarding.view', 'onboarding.update',
    'reports.view', 'audit.view',
    'user.view', 'user.manage',
    'role.view', 'role.manage',
    'organization.view', 'organization.manage',
  ],
  HR_MANAGER: [
    'employee.view', 'employee.create', 'employee.update',
    'salary.view',
    'status.view', 'status.update',
    'assignment.view', 'assignment.update',
    'onboarding.view', 'onboarding.update',
    'reports.view',
    'organization.view',
  ],
  HR_OFFICER: [
    'employee.view', 'employee.create', 'employee.update',
    'status.view', 'status.update',
    'assignment.view',
    'onboarding.view', 'onboarding.update',
    'reports.view',
    'organization.view',
  ],
  FINANCE_DIRECTOR: [
    'employee.view', 'salary.view', 'salary.update', 'reports.view',
  ],
  FINANCE_PAYROLL: [
    'employee.view', 'salary.view', 'reports.view',
  ],
  TREASURY_MANAGER: [
    'employee.view', 'salary.view', 'reports.view',
  ],
  FINANCIAL_CONTROL_REPORTING_MANAGER: [
    'employee.view', 'salary.view', 'reports.view',
  ],
  DISTRIBUTION_MANAGER: [
    'employee.view', 'status.view', 'reports.view', 'organization.view',
  ],
  DISTRIBUTION_OFFICER: [
    'employee.view', 'status.view', 'organization.view',
  ],
  TECHNOLOGY_MANAGER: [
    'employee.view', 'reports.view', 'organization.view',
  ],
  SALES_HEAD: [
    'employee.view', 'status.view', 'reports.view', 'organization.view',
  ],
  AREA_SALES_MANAGER: [
    'employee.view', 'status.view', 'organization.view',
  ],
  SHOP_MANAGER: [
    'employee.view', 'status.view', 'organization.view',
  ],
  EMPLOYEE: [],
  AUDITOR: [
    'employee.view', 'audit.view', 'reports.view',
  ],
}

async function main() {
  console.log('Seeding Phase 1...')

  // 1. Permissions
  const permRecords = await Promise.all(
    ALL_PERMISSIONS.map(key =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      })
    )
  )
  const permMap = Object.fromEntries(permRecords.map(p => [p.key, p.id]))
  console.log(`${permRecords.length} permissions`)

  // 2. Roles + mappings
  const roleRecords: Record<string, string> = {}
  for (const [name, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` },
    })
    roleRecords[name] = role.id
    for (const permKey of perms) {
      const permId = permMap[permKey]
      if (!permId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      })
    }
  }
  console.log(`${Object.keys(roleRecords).length} roles`)

  // 3. Users
  async function createUser(email: string, name: string, password: string, roleName: string) {
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: await bcrypt.hash(password, 12), isActive: true },
    })
    const rId = roleRecords[roleName]
    if (rId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: rId } },
        update: {},
        create: { userId: u.id, roleId: rId },
      })
    }
    return u
  }

  await createUser('admin@leapfrog.com', 'System Admin', 'Admin123!', 'SUPER_ADMIN')
  await createUser('ceo@leapfrog.com', 'CEO', 'Ceo123!', 'CEO')
  await createUser('hr.admin@leapfrog.com', 'HR Admin', 'HrAdmin123!', 'HR_ADMIN')
  await createUser('hr.manager@leapfrog.com', 'HR Manager', 'Hr123!', 'HR_MANAGER')
  await createUser('hr.officer@leapfrog.com', 'HR Officer', 'HrOff123!', 'HR_OFFICER')
  await createUser('finance.director@leapfrog.com', 'Finance Director', 'Fin123!', 'FINANCE_DIRECTOR')
  await createUser('finance.payroll@leapfrog.com', 'Finance Payroll', 'FinPay123!', 'FINANCE_PAYROLL')
  await createUser('sales.head@leapfrog.com', 'Sales Head', 'Sales123!', 'SALES_HEAD')
  await createUser('shop.manager@leapfrog.com', 'Shop Manager', 'Shop123!', 'SHOP_MANAGER')
  await createUser('manager@leapfrog.com', 'Area Sales Manager', 'Mgr123!', 'AREA_SALES_MANAGER')
  await createUser('employee@leapfrog.com', 'Employee User', 'Emp123!', 'EMPLOYEE')
  await createUser('auditor@leapfrog.com', 'Auditor', 'Audit123!', 'AUDITOR')
  console.log('12 users created')

  // 4. Departments
  const deptCodeToId: Record<string, string> = {}
  const deptDefs = [
    { name: 'Head Office', code: 'HO', parentCode: null },
    { name: 'Human Resources', code: 'HR', parentCode: 'HO' },
    { name: 'Finance', code: 'FIN', parentCode: 'HO' },
    { name: 'Sales', code: 'SALES', parentCode: 'HO' },
    { name: 'Distribution', code: 'DIST', parentCode: 'HO' },
    { name: 'Technology', code: 'TECH', parentCode: 'HO' },
  ]
  for (const d of deptDefs) {
    const record = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: { name: d.name, code: d.code, parentId: d.parentCode ? deptCodeToId[d.parentCode] : null },
    })
    deptCodeToId[d.code] = record.id
  }
  console.log(`${deptDefs.length} departments`)

  // 5. Locations (Ethiopia-oriented)
  const locDefs: { name: string; code: string; type: LocationType }[] = [
    { name: 'Head Office - Addis Ababa', code: 'ADD-HO', type: LocationType.DIVISION },
    { name: 'East Addis 1 - Bole', code: 'ADD-E1', type: LocationType.REGION },
    { name: 'East Addis 2 - Ayat', code: 'ADD-E2', type: LocationType.REGION },
    { name: 'Regional - Outside Addis', code: 'REG-EXT', type: LocationType.REGION },
  ]
  const locCodeToId: Record<string, string> = {}
  for (const l of locDefs) {
    const record = await prisma.location.upsert({
      where: { code: l.code },
      update: {},
      create: { name: l.name, code: l.code, type: l.type },
    })
    locCodeToId[l.code] = record.id
  }

  // Shops under East Addis 1 (Bole)
  const shopDefs = [
    { name: 'Bole Arabsa', code: 'SHOP-BA', regionCode: 'ADD-E1' },
    { name: 'Megenagna', code: 'SHOP-MG', regionCode: 'ADD-E1' },
    { name: 'Shiromeda', code: 'SHOP-SH', regionCode: 'ADD-E1' },
    { name: 'Wossen', code: 'SHOP-WS', regionCode: 'ADD-E1' },
  ]
  const shopCodeToId: Record<string, string> = {}
  for (const s of shopDefs) {
    const record = await prisma.location.upsert({
      where: { code: s.code },
      update: {},
      create: { name: s.name, code: s.code, type: LocationType.SHOP, parentId: locCodeToId[s.regionCode] },
    })
    shopCodeToId[s.code] = record.id
  }

  // Clusters
  const clusterDefs = [
    { name: 'Bole Arabsa Cluster - DSA', code: 'CL-BA-DSA', shopCode: 'SHOP-BA' },
    { name: 'Megenagna Cluster - DSA', code: 'CL-MG-DSA', shopCode: 'SHOP-MG' },
  ]
  for (const c of clusterDefs) {
    await prisma.location.upsert({
      where: { code: c.code },
      update: {},
      create: { name: c.name, code: c.code, type: LocationType.CLUSTER, parentId: shopCodeToId[c.shopCode] },
    })
  }
  console.log(`${locDefs.length + shopDefs.length + clusterDefs.length} locations`)

  // 6. Sample employees
  const sampleEmps = [
    { eid: 'LSTA_0001', first: 'Abebe', last: 'Kebede', email: 'abebe.kebede@leapfrog.com', role: EmployeeRole.CEO, level: EmployeeLevel.EXECUTIVE, deptCode: 'HO', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
    { eid: 'LSTA_0002', first: 'Almaz', last: 'Tesfaye', email: 'almaz.tesfaye@leapfrog.com', role: EmployeeRole.HR_MANAGER, level: EmployeeLevel.MANAGER, deptCode: 'HR', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
    { eid: 'LSTA_0003', first: 'Bereket', last: 'Hailu', email: 'bereket.hailu@leapfrog.com', role: EmployeeRole.FINANCE_DIRECTOR, level: EmployeeLevel.DIRECTOR, deptCode: 'FIN', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
    { eid: 'LSTA_0004', first: 'Chaltu', last: 'Bekele', email: 'chaltu.bekele@leapfrog.com', role: EmployeeRole.HR_OFFICER, level: EmployeeLevel.MID, deptCode: 'HR', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
    { eid: 'LSTA_0005', first: 'Dawit', last: 'Mekonnen', email: 'dawit.mekonnen@leapfrog.com', role: EmployeeRole.SALES_HEAD, level: EmployeeLevel.DIRECTOR, deptCode: 'SALES', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
    { eid: 'LSTA_0006', first: 'Eden', last: 'Girma', email: 'eden.girma@leapfrog.com', role: EmployeeRole.SHOP_MANAGER, level: EmployeeLevel.MANAGER, deptCode: 'SALES', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
    { eid: 'LSTA_0007', first: 'Fikru', last: 'Alemu', email: 'fikru.alemu@leapfrog.com', role: EmployeeRole.EMPLOYEE, level: EmployeeLevel.JUNIOR, deptCode: 'SALES', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ON_PROBATION },
    { eid: 'LSTA_0008', first: 'Genet', last: 'Assefa', email: 'genet.assefa@leapfrog.com', role: EmployeeRole.TECHNOLOGY_MANAGER, level: EmployeeLevel.MANAGER, deptCode: 'TECH', empType: EmploymentType.FULL_TIME, status: EmploymentStatus.ACTIVE },
  ]

  for (const emp of sampleEmps) {
    const exists = await prisma.employee.findUnique({ where: { employeeId: emp.eid } })
    if (exists) continue
    await prisma.employee.create({
      data: {
        employeeId: emp.eid,
        firstName: emp.first,
        lastName: emp.last,
        fullName: `${emp.first} ${emp.last}`,
        email: emp.email,
        employmentType: emp.empType,
        employmentStatus: emp.status,
        currentRole: emp.role,
        currentLevel: emp.level,
        currentDepartmentId: deptCodeToId[emp.deptCode] || null,
        hireDate: new Date('2025-01-01'),
      },
    })
  }
  console.log(`${sampleEmps.length} sample employees`)

  // 7. Link users to employees where applicable
  const ceoUser = await prisma.user.findUnique({ where: { email: 'ceo@leapfrog.com' } })
  const ceoEmp = await prisma.employee.findUnique({ where: { employeeId: 'LSTA_0001' } })
  if (ceoUser && ceoEmp) {
    await prisma.user.update({ where: { id: ceoUser.id }, data: { employeeId: ceoEmp.id } })
  }

  const hrAdminUser = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
  const hrAdminEmp = await prisma.employee.findUnique({ where: { employeeId: 'LSTA_0002' } })
  if (hrAdminUser && hrAdminEmp) {
    await prisma.user.update({ where: { id: hrAdminUser.id }, data: { employeeId: hrAdminEmp.id } })
  }

  // 8. Onboarding checklists for sample employees
  const checklistItems = [
    { key: 'id_collected', label: 'ID collected' },
    { key: 'contract_signed', label: 'Contract signed' },
    { key: 'emergency_contact', label: 'Emergency contact added' },
    { key: 'bank_details', label: 'Bank/payment details collected' },
    { key: 'employment_type_confirmed', label: 'Employment type confirmed' },
    { key: 'role_assigned', label: 'Role assigned' },
    { key: 'manager_assigned', label: 'Manager assigned' },
    { key: 'department_assigned', label: 'Department/division assigned' },
    { key: 'salary_confirmed', label: 'Salary confirmed' },
    { key: 'start_date_confirmed', label: 'Start date confirmed' },
    { key: 'documents_uploaded', label: 'Documents uploaded' },
  ]

  const sampleEmployeeRecords = await prisma.employee.findMany({ take: 8, orderBy: { employeeId: 'asc' } })
  for (const emp of sampleEmployeeRecords) {
    const existing = await prisma.onboardingChecklist.findUnique({ where: { employeeId: emp.id } })
    if (existing) continue
    const checklist = await prisma.onboardingChecklist.create({
      data: { employeeId: emp.id },
    })
    for (const item of checklistItems) {
      await prisma.onboardingChecklistItem.create({
        data: {
          checklistId: checklist.id,
          key: item.key,
          label: item.label,
          completed: emp.employmentStatus === 'ACTIVE',
        },
      })
    }
  }
  console.log(`Onboarding checklists created`)

  // 9. Audit logs for seed actions
  const seedUser = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
  if (seedUser) {
    await prisma.auditLog.create({
      data: {
        userId: seedUser.id,
        action: 'OTHER',
        entityType: 'System',
        entityId: 'seed',
        newValue: { event: 'Seed completed' },
      },
    })
  }

  // 10. Salary records for sample employees
  const salaryEmps = await prisma.employee.findMany({ where: { employmentStatus: 'ACTIVE' }, take: 3 })
  for (const emp of salaryEmps) {
    const existingSalary = await prisma.employeeSalary.findFirst({ where: { employeeId: emp.id } })
    if (existingSalary) continue
    const amount = emp.currentRole === 'CEO' ? 150000 : emp.currentRole === 'HR_MANAGER' ? 80000 : 50000
    await prisma.employeeSalary.create({
      data: {
        employeeId: emp.id,
        basicSalary: amount,
        effectiveDate: new Date('2025-01-01'),
        reason: 'Initial salary',
        createdById: seedUser?.id,
      },
    })
    await prisma.employee.update({
      where: { id: emp.id },
      data: { basicSalary: amount, salaryEffectiveDate: new Date('2025-01-01') },
    })
  }

  console.log('Seed complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
