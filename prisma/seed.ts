import { PrismaClient, EmployeeRole, EmployeeLevel, LocationType, EmploymentType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ALL_PERMISSIONS = [
  'employee.view', 'employee.create', 'employee.edit', 'employee.delete', 'employee.status_change',
  'org.view', 'org.edit',
  'user.manage', 'role.manage',
  'leave.view', 'leave.approve', 'leave.manage',
  'evaluation.create', 'evaluation.view', 'evaluation.approve', 'evaluation.manage',
  'disciplinary.create', 'disciplinary.approve', 'disciplinary.manage',
  'termination.create', 'termination.approve', 'termination.manage',
  'transfer.create', 'transfer.approve', 'transfer.manage',
  'promotion.create', 'promotion.approve', 'promotion.manage',
  'salary.view', 'salary.edit', 'salary.approve',
  'commission.view', 'commission.calculate', 'commission.approve',
  'payroll.view', 'payroll.manage', 'payroll.approve', 'payroll.export', 'payroll.lock',
  'report.view', 'report.export',
  'audit.view',
  'document.view', 'document.upload', 'document.manage',
  'self_service.leave', 'self_service.document_upload', 'self_service.profile_edit',
  'settings.view', 'settings.edit',
  'data_quality.view', 'data_quality.resolve',
  'notification.view',
] as const

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  HR_MANAGER: [
    'employee.view', 'employee.create', 'employee.edit', 'employee.status_change',
    'org.view', 'org.edit',
    'user.manage',
    'leave.view', 'leave.approve', 'leave.manage',
    'evaluation.create', 'evaluation.view', 'evaluation.approve', 'evaluation.manage',
    'disciplinary.create', 'disciplinary.approve', 'disciplinary.manage',
    'termination.create', 'termination.approve', 'termination.manage',
    'transfer.create', 'transfer.approve', 'transfer.manage',
    'promotion.create', 'promotion.approve', 'promotion.manage',
    'salary.view', 'salary.edit', 'salary.approve',
    'commission.view', 'commission.calculate', 'commission.approve',
    'payroll.view', 'payroll.manage', 'payroll.approve', 'payroll.export', 'payroll.lock',
    'report.view', 'report.export',
    'audit.view',
    'document.view', 'document.upload', 'document.manage',
    'settings.view',
    'data_quality.view', 'data_quality.resolve',
    'notification.view',
  ],
  HR_OFFICER: [
    'employee.view', 'employee.create', 'employee.edit',
    'org.view',
    'leave.view', 'leave.approve',
    'evaluation.create', 'evaluation.view',
    'disciplinary.create',
    'document.view', 'document.upload',
    'report.view',
    'notification.view',
  ],
  MANAGER: [
    'employee.view',
    'org.view',
    'leave.view', 'leave.approve',
    'evaluation.create', 'evaluation.view',
    'document.view', 'document.upload',
    'self_service.leave', 'self_service.document_upload', 'self_service.profile_edit',
    'report.view',
    'notification.view',
  ],
  EMPLOYEE: [
    'self_service.leave', 'self_service.document_upload', 'self_service.profile_edit',
    'notification.view',
  ],
}

async function main() {
  console.log('Seeding database...')

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
  console.log(`Created ${permRecords.length} permissions`)

  const roleRecords = await Promise.all(
    Object.entries(ROLE_PERMISSIONS).map(async ([name, perms]) => {
      const role = await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: `${name} role` },
      })
      for (const permKey of perms) {
        const permId = permMap[permKey]
        if (!permId) continue
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        })
      }
      return role
    })
  )
  console.log(`Created ${roleRecords.length} roles`)

  const adminRole = roleRecords.find(r => r.name === 'SUPER_ADMIN')!

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@leapfrog.com' },
    update: {},
    create: {
      email: 'admin@leapfrog.com',
      name: 'System Admin',
      passwordHash: await bcrypt.hash('Admin123!', 12),
      isActive: true,
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  })
  console.log(`Created admin user: admin@leapfrog.com / Admin123!`)

  const hrManagerRole = roleRecords.find(r => r.name === 'HR_MANAGER')!
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@leapfrog.com' },
    update: {},
    create: {
      email: 'hr@leapfrog.com',
      name: 'HR Manager',
      passwordHash: await bcrypt.hash('Hr123!', 12),
      isActive: true,
    },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: hrUser.id, roleId: hrManagerRole.id } },
    update: {},
    create: { userId: hrUser.id, roleId: hrManagerRole.id },
  })
  console.log(`Created HR user: hr@leapfrog.com / Hr123!`)

  const departments = [
    { name: 'Head Office', code: 'HO', headId: null, parentId: null },
    { name: 'Human Resources', code: 'HR', headId: null, parentId: null },
    { name: 'Finance', code: 'FIN', headId: null, parentId: null },
    { name: 'Sales', code: 'SALES', headId: null, parentId: null },
    { name: 'Technology', code: 'TECH', headId: null, parentId: null },
  ]
  const deptRecords: Record<string, string> = {}
  for (const dept of departments) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    })
    deptRecords[dept.code] = record.id
  }
  console.log(`Created ${Object.keys(deptRecords).length} departments`)

  const locations = [
    { name: 'Head Office - Kathmandu', code: 'KTM-HO', type: LocationType.DIVISION, parentId: null, managerId: null },
    { name: 'Kathmandu Region', code: 'KTM-REG', type: LocationType.REGION, parentId: null, managerId: null },
    { name: 'Lalitpur Region', code: 'LTP-REG', type: LocationType.REGION, parentId: null, managerId: null },
  ]
  const locRecords: Record<string, string> = {}
  for (const loc of locations) {
    const record = await prisma.location.upsert({
      where: { code: loc.code },
      update: {},
      create: loc,
    })
    locRecords[loc.code] = record.id
  }
  console.log(`Created ${Object.keys(locRecords).length} locations`)

  const sampleEmployees = [
    { employeeId: 'LSTA_0001', firstName: 'John', lastName: 'Doe', fullName: 'John Doe', email: 'john.doe@leapfrog.com', role: EmployeeRole.CEO, level: EmployeeLevel.EXECUTIVE, dept: 'HO' },
    { employeeId: 'LSTA_0002', firstName: 'Jane', lastName: 'Smith', fullName: 'Jane Smith', email: 'jane.smith@leapfrog.com', role: EmployeeRole.HR_MANAGER, level: EmployeeLevel.MANAGER, dept: 'HR' },
  ]

  for (const emp of sampleEmployees) {
    const exists = await prisma.employee.findUnique({ where: { employeeId: emp.employeeId } })
    if (exists) continue

    await prisma.employee.create({
      data: {
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: emp.fullName,
        email: emp.email,
        employmentType: EmploymentType.FULL_TIME,
        currentRole: emp.role,
        currentLevel: emp.level,
        currentDepartmentId: deptRecords[emp.dept] || null,
      },
    })
  }
  console.log(`Created ${sampleEmployees.length} sample employees`)

  console.log('Seed complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
