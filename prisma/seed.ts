import { PrismaClient, EmployeeRole, EmployeeLevel, LocationType, EmploymentType, EmploymentStatus, EmployeeCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ALL_PERMISSIONS = [
  'employee.view', 'employee.create', 'employee.update', 'employee.delete',
  'salary.view', 'salary.update',
  'status.view', 'status.update',
  'assignment.view', 'assignment.update',
  'onboarding.view', 'onboarding.update', 'onboarding.complete',
  'reports.view',
  'audit.view',
  'user.view', 'user.manage',
  'role.view', 'role.manage',
  'organization.view', 'organization.manage',
  'document.view', 'document.upload', 'document.download', 'document.deactivate', 'document.manageRules',
  'employee.import', 'employee.importPreview', 'employee.importConfirm',
  'employee.importHistory', 'employee.payrollReadiness.view', 'employee.payrollReadiness.export',
  'salaryStructure.view', 'salaryStructure.manageComponents', 'salaryStructure.manageRules',
  'salaryStructure.preview', 'salaryStructure.activateRule', 'salaryStructure.deactivateRule',
  'salaryStructure.auditView',
  'dataQuality.view', 'dataQuality.manage', 'dataQuality.export',
  'changeRequest.view', 'changeRequest.create', 'changeRequest.approve', 'changeRequest.reject', 'changeRequest.cancel',
  'salaryRuleApproval.view', 'salaryRuleApproval.request', 'salaryRuleApproval.approve', 'salaryRuleApproval.reject',
  'phaseControl.view', 'phaseControl.update',
  'payrollPeriod.view', 'payrollPeriod.create', 'payrollPeriod.update', 'payrollPeriod.open', 'payrollPeriod.close', 'payrollPeriod.cancel',
  'payrollInputType.view', 'payrollInputType.manage',
  'payrollInput.view', 'payrollInput.create', 'payrollInput.submit', 'payrollInput.review', 'payrollInput.import', 'payrollInput.export',
] as const

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  HR_ADMIN: [
    'employee.view', 'employee.create', 'employee.update',
    'salary.view', 'salary.update',
    'status.view', 'status.update',
    'assignment.view', 'assignment.update',
    'onboarding.view', 'onboarding.update', 'onboarding.complete',
    'organization.view',
    'audit.view',
    'document.view', 'document.upload', 'document.download', 'document.deactivate', 'document.manageRules',
    'employee.import', 'employee.importPreview', 'employee.importConfirm',
    'employee.importHistory', 'employee.payrollReadiness.view', 'employee.payrollReadiness.export',
    'salaryStructure.view', 'salaryStructure.manageComponents', 'salaryStructure.manageRules',
    'salaryStructure.preview', 'salaryStructure.activateRule', 'salaryStructure.deactivateRule',
    'salaryStructure.auditView',
    'dataQuality.view', 'dataQuality.manage', 'dataQuality.export',
    'changeRequest.view', 'changeRequest.create', 'changeRequest.approve', 'changeRequest.reject', 'changeRequest.cancel',
    'salaryRuleApproval.view', 'salaryRuleApproval.request',
    'phaseControl.view', 'phaseControl.update',
    'payrollPeriod.view', 'payrollPeriod.create', 'payrollPeriod.update', 'payrollPeriod.open', 'payrollPeriod.close', 'payrollPeriod.cancel',
    'payrollInputType.view', 'payrollInputType.manage',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit', 'payrollInput.review', 'payrollInput.import', 'payrollInput.export',
  ],
  HR_OFFICER: [
    'employee.view', 'employee.create', 'employee.update',
    'status.view', 'status.update',
    'assignment.view', 'assignment.update',
    'onboarding.view', 'onboarding.update', 'onboarding.complete',
    'document.view', 'document.upload',
    'employee.import', 'employee.importPreview', 'employee.importConfirm',
    'employee.importHistory', 'employee.payrollReadiness.view', 'employee.payrollReadiness.export',
    'salaryStructure.view',
    'dataQuality.view', 'dataQuality.manage',
    'changeRequest.view', 'changeRequest.create',
    'salaryRuleApproval.view', 'salaryRuleApproval.request',
    'phaseControl.view',
    'payrollPeriod.view',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit', 'payrollInput.import',
    'payrollInputType.view',
  ],
  FINANCE_DIRECTOR: [
    'employee.view', 'salary.view', 'salary.update',
    'reports.view', 'audit.view',
    'document.view', 'document.download',
    'employee.payrollReadiness.view', 'employee.payrollReadiness.export',
    'salaryStructure.view', 'salaryStructure.manageComponents', 'salaryStructure.manageRules',
    'salaryStructure.preview', 'salaryStructure.activateRule', 'salaryStructure.deactivateRule',
    'salaryStructure.auditView',
    'dataQuality.view', 'dataQuality.export',
    'changeRequest.view', 'changeRequest.approve', 'changeRequest.reject',
    'salaryRuleApproval.view', 'salaryRuleApproval.approve', 'salaryRuleApproval.reject',
    'phaseControl.view', 'phaseControl.update',
    'payrollPeriod.view', 'payrollPeriod.open', 'payrollPeriod.close',
    'payrollInput.view', 'payrollInput.review', 'payrollInput.export',
    'payrollInputType.view',
  ],
  FINANCE_PAYROLL: [
    'employee.view', 'salary.view', 'reports.view',
    'document.view', 'document.download',
    'employee.payrollReadiness.view', 'employee.payrollReadiness.export',
    'salaryStructure.view', 'salaryStructure.preview',
    'dataQuality.view',
    'changeRequest.view', 'changeRequest.create', 'changeRequest.approve', 'changeRequest.reject',
    'phaseControl.view',
    'payrollPeriod.view', 'payrollPeriod.create', 'payrollPeriod.update',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit', 'payrollInput.review', 'payrollInput.import', 'payrollInput.export',
    'payrollInputType.view',
  ],
  TREASURY_MANAGER: [
    'employee.view', 'salary.view',
    'document.view', 'document.download',
    'salaryStructure.view', 'salaryStructure.preview',
  ],
  ACCOUNTANT: [
    'employee.view', 'salary.view',
    'document.view',
    'salaryStructure.view', 'salaryStructure.preview',
  ],
  SALES_HEAD: [
    'employee.view', 'reports.view', 'organization.view',
    'document.view',
    'dataQuality.view',
    'phaseControl.view',
    'payrollPeriod.view',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit',
  ],
  ASM: [
    'employee.view', 'reports.view',
    'document.view',
    'payrollPeriod.view',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit',
  ],
  SHOP_MANAGER: [
    'employee.view',
    'document.view',
    'employee.payrollReadiness.view',
    'employee.payrollReadiness.export',
    'payrollPeriod.view',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit',
  ],
  EMPLOYEE: [],
  AUDITOR: [
    'audit.view', 'reports.view',
    'dataQuality.view',
    'changeRequest.view',
    'salaryRuleApproval.view',
    'phaseControl.view',
    'payrollPeriod.view',
    'payrollInput.view',
    'payrollInputType.view',
  ],
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

async function getNextEmployeeId(): Promise<string> {
  const last = await prisma.employee.findFirst({
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  })
  if (!last) return 'LSTA_0001'
  const num = parseInt(last.employeeId.split('_')[1], 10)
  return `LSTA_${String(num + 1).padStart(4, '0')}`
}

async function main() {
  console.log('Seeding Leapfrog HR database...')

  // Clean existing data in dependency order
  await prisma.auditLog.deleteMany()
  await prisma.importRow.deleteMany()
  await prisma.importSession.deleteMany()
  await prisma.payrollInput.deleteMany()
  await prisma.payrollPeriodEmployee.deleteMany()
  await prisma.payrollPeriod.deleteMany()
  await prisma.payrollInputType.deleteMany()
  await prisma.employeePayrollProfile.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.onboardingChecklistItem.deleteMany()
  await prisma.onboardingChecklist.deleteMany()
  await prisma.employeeStatusHistory.deleteMany()
  await prisma.employeeAssignment.deleteMany()
  await prisma.employeeSalary.deleteMany()
  await prisma.employeeDocument.deleteMany()
  await prisma.salaryReview.deleteMany()
  await prisma.achievement.deleteMany()
  await prisma.disciplinaryRecord.deleteMany()
  await prisma.terminationCase.deleteMany()
  await prisma.transferRequest.deleteMany()
  await prisma.promotionRequest.deleteMany()
  await prisma.commissionCalculation.deleteMany()
  await prisma.leaveRecord.deleteMany()
  await prisma.employeeEvaluation.deleteMany()
  await prisma.employeeProfileChangeRequest.deleteMany()
  await prisma.payrollAllowance.deleteMany()
  await prisma.payrollDeduction.deleteMany()
  await prisma.payrollAttendanceInput.deleteMany()
  await prisma.payrollPreparationRow.deleteMany()
  await prisma.payrollPreparationBatch.deleteMany()
  await prisma.payrollAdjustment.deleteMany()
  await prisma.payrollPeriodLock.deleteMany()
  await prisma.payeTaxBracket.deleteMany()
  await prisma.pensionRule.deleteMany()
  await prisma.payrollRule.deleteMany()
  await prisma.payRule.deleteMany()
  await prisma.payComponent.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.location.deleteMany()
  await prisma.department.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.userRole.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()
  await prisma.user.deleteMany()

  console.log('  Cleaned existing data')

  // Create permissions
  const permissionRecords = await Promise.all(
    ALL_PERMISSIONS.map(key =>
      prisma.permission.create({ data: { key, description: key } })
    )
  )
  const permMap = Object.fromEntries(permissionRecords.map(p => [p.key, p.id]))
  console.log(`  Created ${permissionRecords.length} permissions`)

  // Create roles
  const roleRecords = await Promise.all(
    Object.entries(ROLE_PERMISSIONS).map(async ([name, perms]) => {
      const role = await prisma.role.create({
        data: { name, description: `${name} role` },
      })
      await prisma.rolePermission.createMany({
        data: perms.map(p => ({ roleId: role.id, permissionId: permMap[p] })),
      })
      return role
    })
  )
  const roleMap = Object.fromEntries(roleRecords.map(r => [r.name, r.id]))
  console.log(`  Created ${roleRecords.length} roles with permissions`)

  // Create users
  const password = await hashPassword('Test123!')
  const ALL_USERS = [
    { email: 'admin@leapfrog.com', name: 'Super Admin', roles: ['SUPER_ADMIN'] },
    { email: 'hr.admin@leapfrog.com', name: 'Almaz Tesfaye', roles: ['HR_ADMIN'] },
    { email: 'hr.officer@leapfrog.com', name: 'Dawit Eshetu', roles: ['HR_OFFICER'] },
    { email: 'finance.director@leapfrog.com', name: 'Selamawit Gebre', roles: ['FINANCE_DIRECTOR'] },
    { email: 'finance.payroll@leapfrog.com', name: 'Genet Mengistu', roles: ['FINANCE_PAYROLL'] },
    { email: 'treasury@leapfrog.com', name: 'Henok Desta', roles: ['TREASURY_MANAGER'] },
    { email: 'sales.head@leapfrog.com', name: 'Biruk Tadesse', roles: ['SALES_HEAD'] },
    { email: 'asm@leapfrog.com', name: 'Aster Desta', roles: ['ASM'] },
    { email: 'shop.manager@leapfrog.com', name: 'Tesfaye Hailu', roles: ['SHOP_MANAGER'] },
    { email: 'shop.manager2@leapfrog.com', name: 'Lemlem Berhe', roles: ['SHOP_MANAGER'] },
    { email: 'dsp@leapfrog.com', name: 'Kidus Yohannes', roles: ['EMPLOYEE'] },
    { email: 'dsa@leapfrog.com', name: 'Meron Tadesse', roles: ['EMPLOYEE'] },
    { email: 'shopacct@leapfrog.com', name: 'Bezawit Assefa', roles: ['EMPLOYEE'] },
    { email: 'employee@leapfrog.com', name: 'Employee User', roles: ['EMPLOYEE'] },
    { email: 'auditor@leapfrog.com', name: 'Yonas Tadesse', roles: ['AUDITOR'] },
  ]
  const userRecords = await Promise.all(
    ALL_USERS.map(async u => {
      const user = await prisma.user.create({
        data: { email: u.email, name: u.name, passwordHash: password, isActive: true },
      })
      await prisma.userRole.createMany({
        data: u.roles.map(r => ({ userId: user.id, roleId: roleMap[r] })),
      })
      return user
    })
  )
  const userMap = Object.fromEntries(userRecords.map(u => [u.email, u.id]))
  console.log(`  Created ${userRecords.length} users`)

  // Create departments
  const deptRecords = await Promise.all([
    prisma.department.create({ data: { name: 'CEO Office', code: 'CEO' } }),
    prisma.department.create({ data: { name: 'Sales', code: 'SALES' } }),
    prisma.department.create({ data: { name: 'Distribution', code: 'DIST' } }),
    prisma.department.create({ data: { name: 'Finance', code: 'FIN' } }),
    prisma.department.create({ data: { name: 'Human Resources', code: 'HR' } }),
    prisma.department.create({ data: { name: 'Technology', code: 'TECH' } }),
  ])
  const deptMap = Object.fromEntries(deptRecords.map(d => [d.code, d.id]))
  console.log(`  Created ${deptRecords.length} departments`)

  // Create locations - regions, areas, shops
  const regionRecords = await Promise.all([
    prisma.location.create({ data: { name: 'Addis Ababa', code: 'ADDIS', type: 'REGION' as LocationType } }),
  ])
  const regionMap = Object.fromEntries(regionRecords.map(r => [r.code, r.id]))

  const areaRecords = await Promise.all([
    prisma.location.create({ data: { name: 'Megenagna Area', code: 'MEGENAGNA', type: 'AREA' as LocationType, parentId: regionMap['ADDIS'] } }),
    prisma.location.create({ data: { name: 'Shiromeda Area', code: 'SHIROMEDA', type: 'AREA' as LocationType, parentId: regionMap['ADDIS'] } }),
  ])
  const areaMap = Object.fromEntries(areaRecords.map(a => [a.code, a.id]))

  const shopRecords = await Promise.all([
    prisma.location.create({ data: { name: 'Megenagna Shop', code: 'SHOP_MEG', type: 'SHOP' as LocationType, parentId: areaMap['MEGENAGNA'] } }),
    prisma.location.create({ data: { name: 'Shiromeda Shop', code: 'SHOP_SHI', type: 'SHOP' as LocationType, parentId: areaMap['SHIROMEDA'] } }),
    prisma.location.create({ data: { name: 'Wossen Shop', code: 'SHOP_WOS', type: 'SHOP' as LocationType, parentId: areaMap['MEGENAGNA'] } }),
    prisma.location.create({ data: { name: 'Bole Arabsa Shop', code: 'SHOP_BOL', type: 'SHOP' as LocationType, parentId: areaMap['MEGENAGNA'] } }),
    prisma.location.create({ data: { name: 'Meri Ayat Shop', code: 'SHOP_MER', type: 'SHOP' as LocationType, parentId: areaMap['SHIROMEDA'] } }),
    prisma.location.create({ data: { name: 'Ayat Tafo Shop', code: 'SHOP_AYT', type: 'SHOP' as LocationType, parentId: areaMap['SHIROMEDA'] } }),
  ])
  const shopMap = Object.fromEntries(shopRecords.map(s => [s.code, s.id]))
  console.log(`  Created ${regionRecords.length + areaRecords.length + shopRecords.length} locations`)

  // Create employees in order of reporting hierarchy
  // We'll build them and track IDs for manager references

  const empId = await getNextEmployeeId()

  // Helper to create employee
  async function createEmployee(data: {
    firstName: string; middleName?: string; lastName: string; email: string; phoneNumber: string
    gender: string; hireDate: Date; employmentType: EmploymentType; employmentStatus: EmploymentStatus
    employeeCategory?: EmployeeCategory; currentDepartmentId?: string; currentRegionId?: string
    currentAreaId?: string; currentShopId?: string; currentRole: EmployeeRole; currentLevel: EmployeeLevel
    directManagerId?: string; accountingReportingManagerId?: string; basicSalary?: number
    userEmail: string; notes?: string
  }) {
    const eid = await getNextEmployeeId()
    const employee = await prisma.employee.create({
      data: {
        employeeId: eid,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        fullName: [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' '),
        gender: data.gender,
        phoneNumber: data.phoneNumber,
        email: data.email || null,
        hireDate: data.hireDate,
        employmentType: data.employmentType,
        employmentStatus: data.employmentStatus,
        employeeCategory: data.employeeCategory || null,
        currentDepartmentId: data.currentDepartmentId || null,
        currentRegionId: data.currentRegionId || null,
        currentAreaId: data.currentAreaId || null,
        currentShopId: data.currentShopId || null,
        currentRole: data.currentRole,
        currentLevel: data.currentLevel,
        directManagerId: data.directManagerId || null,
        accountingReportingManagerId: data.accountingReportingManagerId || null,
        basicSalary: data.basicSalary || null,
        salaryEffectiveDate: data.basicSalary ? data.hireDate : null,
        notes: data.notes || null,
        createdById: userMap['admin@leapfrog.com'],
      },
    })

    // Link user to employee
    const user = userRecords.find(u => u.email === data.userEmail)
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { employeeId: employee.id } })
    }

    // Create initial assignment
    await prisma.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        employeeCategory: data.employeeCategory || null,
        departmentId: data.currentDepartmentId || null,
        regionId: data.currentRegionId || null,
        areaId: data.currentAreaId || null,
        shopId: data.currentShopId || null,
        role: data.currentRole,
        level: data.currentLevel,
        directManagerId: data.directManagerId || null,
        accountingReportingManagerId: data.accountingReportingManagerId || null,
        startDate: data.hireDate,
        reason: 'Initial assignment',
      },
    })

    // Create status history
    await prisma.employeeStatusHistory.create({
      data: {
        employeeId: employee.id,
        newStatus: data.employmentStatus,
        reason: 'Initial status on creation',
        effectiveDate: data.hireDate,
        updatedById: userMap['admin@leapfrog.com'],
      },
    })

    return employee
  }

  // Pass 1: Create all employees
  const ceo = await createEmployee({
    firstName: 'Abebe', lastName: 'Kebede', email: 'ceo@leapfrog.com',
    phoneNumber: '+251911100001', gender: 'MALE', hireDate: new Date('2023-01-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['CEO'], currentRole: 'CEO' as EmployeeRole, currentLevel: 'EXECUTIVE' as EmployeeLevel,
    basicSalary: 250000, userEmail: 'admin@leapfrog.com',
  })

  const hrManager = await createEmployee({
    firstName: 'Almaz', lastName: 'Tesfaye', email: 'hr@leapfrog.com',
    phoneNumber: '+251911100002', gender: 'FEMALE', hireDate: new Date('2023-02-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['HR'], currentRole: 'HR_MANAGER' as EmployeeRole, currentLevel: 'MANAGER' as EmployeeLevel,
    directManagerId: ceo.id, basicSalary: 80000, userEmail: 'hr.admin@leapfrog.com',
  })

  const hrOfficer = await createEmployee({
    firstName: 'Dawit', lastName: 'Eshetu', email: 'hr.officer@leapfrog.com',
    phoneNumber: '+251911100003', gender: 'MALE', hireDate: new Date('2023-03-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['HR'], currentRole: 'HR_OFFICER' as EmployeeRole, currentLevel: 'MID' as EmployeeLevel,
    directManagerId: hrManager.id, basicSalary: 45000, userEmail: 'hr.officer@leapfrog.com',
  })

  const financeDirector = await createEmployee({
    firstName: 'Selamawit', lastName: 'Gebre', email: 'finance.director@leapfrog.com',
    phoneNumber: '+251911100004', gender: 'FEMALE', hireDate: new Date('2023-01-15'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['FIN'], currentRole: 'FINANCE_DIRECTOR' as EmployeeRole, currentLevel: 'DIRECTOR' as EmployeeLevel,
    directManagerId: ceo.id, basicSalary: 180000, userEmail: 'finance.director@leapfrog.com',
  })

  const treasuryManager = await createEmployee({
    firstName: 'Henok', lastName: 'Desta', email: 'treasury@leapfrog.com',
    phoneNumber: '+251911100005', gender: 'MALE', hireDate: new Date('2023-02-15'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['FIN'], currentRole: 'TREASURY_MANAGER' as EmployeeRole, currentLevel: 'MANAGER' as EmployeeLevel,
    directManagerId: financeDirector.id, basicSalary: 90000, userEmail: 'treasury@leapfrog.com',
  })

  const accountant = await createEmployee({
    firstName: 'Genet', lastName: 'Mengistu', email: 'finance.payroll@leapfrog.com',
    phoneNumber: '+251911100006', gender: 'FEMALE', hireDate: new Date('2023-03-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['FIN'], currentRole: 'ACCOUNTANT' as EmployeeRole, currentLevel: 'SENIOR' as EmployeeLevel,
    directManagerId: treasuryManager.id, basicSalary: 55000, userEmail: 'finance.payroll@leapfrog.com',
  })

  const salesHead = await createEmployee({
    firstName: 'Biruk', lastName: 'Tadesse', email: 'sales.head@leapfrog.com',
    phoneNumber: '+251911100007', gender: 'MALE', hireDate: new Date('2023-01-10'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'HEAD_OFFICE' as EmployeeCategory,
    currentDepartmentId: deptMap['SALES'], currentRole: 'SALES_HEAD' as EmployeeRole, currentLevel: 'DIRECTOR' as EmployeeLevel,
    directManagerId: ceo.id, basicSalary: 150000, userEmail: 'sales.head@leapfrog.com',
  })

  const asmEmployee = await createEmployee({
    firstName: 'Aster', lastName: 'Desta', email: 'asm@leapfrog.com',
    phoneNumber: '+251911100008', gender: 'FEMALE', hireDate: new Date('2023-04-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'SHOP_FIELD' as EmployeeCategory,
    currentDepartmentId: deptMap['SALES'], currentRegionId: regionMap['ADDIS'],
    currentAreaId: areaMap['MEGENAGNA'],
    currentRole: 'ASM' as EmployeeRole, currentLevel: 'MANAGER' as EmployeeLevel,
    directManagerId: salesHead.id, basicSalary: 70000, userEmail: 'asm@leapfrog.com',
  })

  const shopManagerMegenagna = await createEmployee({
    firstName: 'Tesfaye', lastName: 'Hailu', email: 'shop.manager@leapfrog.com',
    phoneNumber: '+251911100009', gender: 'MALE', hireDate: new Date('2023-05-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'SHOP_FIELD' as EmployeeCategory,
    currentRegionId: regionMap['ADDIS'], currentAreaId: areaMap['MEGENAGNA'],
    currentShopId: shopMap['SHOP_MEG'],
    currentRole: 'SHOP_MANAGER' as EmployeeRole, currentLevel: 'MANAGER' as EmployeeLevel,
    directManagerId: asmEmployee.id, basicSalary: 35000, userEmail: 'shop.manager@leapfrog.com',
  })

  const shopManagerShiromeda = await createEmployee({
    firstName: 'Lemlem', lastName: 'Berhe', email: 'shopmgr.shiromeda@leapfrog.com',
    phoneNumber: '+251911100010', gender: 'FEMALE', hireDate: new Date('2023-05-15'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'SHOP_FIELD' as EmployeeCategory,
    currentRegionId: regionMap['ADDIS'], currentAreaId: areaMap['SHIROMEDA'],
    currentShopId: shopMap['SHOP_SHI'],
    currentRole: 'SHOP_MANAGER' as EmployeeRole, currentLevel: 'MANAGER' as EmployeeLevel,
    directManagerId: asmEmployee.id, basicSalary: 35000,
    userEmail: 'shop.manager2@leapfrog.com',
  })

  const dspEmployee = await createEmployee({
    firstName: 'Kidus', lastName: 'Yohannes', email: 'dsp.megenagna@leapfrog.com',
    phoneNumber: '+251911100011', gender: 'MALE', hireDate: new Date('2023-06-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'SHOP_FIELD' as EmployeeCategory,
    currentRegionId: regionMap['ADDIS'], currentAreaId: areaMap['MEGENAGNA'],
    currentShopId: shopMap['SHOP_MEG'],
    currentRole: 'DSP' as EmployeeRole, currentLevel: 'JUNIOR' as EmployeeLevel,
    directManagerId: shopManagerMegenagna.id, basicSalary: 12000,
    userEmail: 'dsp@leapfrog.com',
  })

  const dsaEmployee = await createEmployee({
    firstName: 'Meron', lastName: 'Tadesse', email: 'dsa.shiromeda@leapfrog.com',
    phoneNumber: '+251911100012', gender: 'FEMALE', hireDate: new Date('2023-06-15'),
    employmentType: 'COMMISSION_BASED' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'SHOP_FIELD' as EmployeeCategory,
    currentRegionId: regionMap['ADDIS'], currentAreaId: areaMap['SHIROMEDA'],
    currentShopId: shopMap['SHOP_SHI'],
    currentRole: 'DSA' as EmployeeRole, currentLevel: 'JUNIOR' as EmployeeLevel,
    directManagerId: shopManagerShiromeda.id, basicSalary: 8000,
    userEmail: 'dsa@leapfrog.com',
  })

  const shopAccountant = await createEmployee({
    firstName: 'Bezawit', lastName: 'Assefa', email: 'shopacct.megenagna@leapfrog.com',
    phoneNumber: '+251911100013', gender: 'FEMALE', hireDate: new Date('2023-07-01'),
    employmentType: 'FULL_TIME' as EmploymentType, employmentStatus: 'ACTIVE' as EmploymentStatus,
    employeeCategory: 'SHOP_FIELD' as EmployeeCategory,
    currentRegionId: regionMap['ADDIS'], currentAreaId: areaMap['MEGENAGNA'],
    currentShopId: shopMap['SHOP_MEG'],
    currentRole: 'SHOP_ACCOUNTANT' as EmployeeRole, currentLevel: 'MID' as EmployeeLevel,
    directManagerId: shopManagerMegenagna.id,
    accountingReportingManagerId: treasuryManager.id,
    basicSalary: 25000,
    userEmail: 'shopacct@leapfrog.com',
  })

  // Auditor (no employee record needed - just a user)
  const auditorEmail = 'auditor@leapfrog.com'
  const auditorUser = userRecords.find(u => u.email === auditorEmail)
  if (auditorUser) {
    await prisma.user.update({ where: { id: auditorUser.id }, data: { name: 'Yonas Tadesse' } })
  }

  console.log(`  Created employees with assignments and status history`)

  // Create payroll profiles for some employees (variety for payroll readiness testing)
  const payrollProfiles = [
    { employeeId: ceo.id, paymentMethod: 'BANK_TRANSFER', bankName: 'Commercial Bank of Ethiopia', bankAccountNumber: '1000123456789', taxId: 'TIN-001', pensionId: 'PEN-001', costCenter: 'CEO-01' },
    { employeeId: hrManager.id, paymentMethod: 'BANK_TRANSFER', bankName: 'Dashen Bank', bankAccountNumber: '2000987654321', taxId: 'TIN-002', pensionId: 'PEN-002', costCenter: 'HR-01' },
    { employeeId: accountant.id, paymentMethod: 'BANK_TRANSFER', bankName: 'Awash Bank', bankAccountNumber: '3000555666777', taxId: 'TIN-003', costCenter: 'FIN-01' },
    { employeeId: shopManagerMegenagna.id, paymentMethod: 'MOBILE_MONEY', mpesaAccount: '+251911100009', costCenter: 'SALES-MEG' },
    { employeeId: dspEmployee.id, paymentMethod: 'MOBILE_MONEY', mpesaAccount: '+251911100011' },
    // DSA: no payroll profile (missing payment info)
    // Shop accountant: has profile but missing tax ID
    { employeeId: shopAccountant.id, paymentMethod: 'BANK_TRANSFER', bankName: 'CBE', bankAccountNumber: '4000111222333', costCenter: 'SALES-MEG' },
  ]
  for (const profile of payrollProfiles) {
    await prisma.employeePayrollProfile.create({ data: { ...profile, updatedById: userMap['admin@leapfrog.com'] } })
  }
  console.log(`  Created ${payrollProfiles.length} payroll profiles`)

  // Create sample audit log
  await prisma.auditLog.create({
    data: {
      userId: userMap['admin@leapfrog.com'],
      action: 'LOGIN',
      entityType: 'User',
      entityId: userMap['admin@leapfrog.com'],
      newValue: { method: 'seed' },
    },
  })
  console.log('  Created sample audit log')

  // Create required document rules
  const commonRules = [
    { name: 'ID Document', documentType: 'ID' as const },
    { name: 'Employment Contract', documentType: 'CONTRACT' as const },
    { name: 'Emergency Contact', documentType: 'EMERGENCY_CONTACT' as const },
  ]
  const hoRules = [
    { name: 'CV / Resume', documentType: 'CV' as const, applicableEmployeeCategory: 'HEAD_OFFICE' as const },
    { name: 'Confidentiality Agreement', documentType: 'CONFIDENTIALITY_DOCUMENT' as const, applicableEmployeeCategory: 'HEAD_OFFICE' as const },
  ]
  const shopFieldRules = [
    { name: 'Responsibility Document', documentType: 'RESPONSIBILITY_DOCUMENT' as const, applicableEmployeeCategory: 'SHOP_FIELD' as const },
    { name: 'Assignment Letter', documentType: 'ASSIGNMENT_LETTER' as const, applicableEmployeeCategory: 'SHOP_FIELD' as const },
  ]
  const shopAcctRules = [
    { name: 'Bank / Payment Information', documentType: 'BANK_OR_PAYMENT_INFORMATION' as const, applicableRole: 'SHOP_ACCOUNTANT' as const },
    { name: 'Confidentiality (Shop Accountant)', documentType: 'CONFIDENTIALITY_DOCUMENT' as const, applicableRole: 'SHOP_ACCOUNTANT' as const },
  ]

  const allRules = [...commonRules, ...hoRules, ...shopFieldRules, ...shopAcctRules]
  await prisma.requiredDocumentRule.createMany({ data: allRules })
  console.log(`  Created ${allRules.length} required document rules`)

  // Create default pay components
  const defaultComponents = [
    { code: 'BASIC_SALARY', name: 'Basic Salary', componentType: 'BASIC_SALARY' as const, isEarning: true, isDeduction: false, isStatutory: false, isVariable: false, taxTreatment: 'TAXABLE' as const },
    { code: 'TRANSPORT_ALLOWANCE', name: 'Transport Allowance', componentType: 'TRANSPORT' as const, isEarning: true, isDeduction: false, isStatutory: false, isVariable: false, taxTreatment: 'NON_TAXABLE' as const },
    { code: 'KPI_ALLOWANCE', name: 'KPI Allowance', componentType: 'KPI' as const, isEarning: true, isDeduction: false, isStatutory: false, isVariable: true, taxTreatment: 'TAXABLE' as const },
    { code: 'OVERTIME', name: 'Overtime', componentType: 'OVERTIME' as const, isEarning: true, isDeduction: false, isStatutory: false, isVariable: true, taxTreatment: 'TAXABLE' as const },
    { code: 'SALES_COMMISSION', name: 'Sales Commission', componentType: 'COMMISSION' as const, isEarning: true, isDeduction: false, isStatutory: false, isVariable: true, taxTreatment: 'TAXABLE' as const },
    { code: 'BONUS', name: 'Bonus', componentType: 'BONUS' as const, isEarning: true, isDeduction: false, isStatutory: false, isVariable: true, taxTreatment: 'TAXABLE' as const },
    { code: 'ADJUSTMENT', name: 'Adjustment', componentType: 'ADJUSTMENT' as const, isEarning: false, isDeduction: false, isStatutory: false, isVariable: true, taxTreatment: 'TAXABLE' as const },
    { code: 'DEDUCTION', name: 'General Deduction', componentType: 'DEDUCTION' as const, isEarning: false, isDeduction: true, isStatutory: false, isVariable: false, taxTreatment: 'NON_TAXABLE' as const },
  ]
  const componentRecords = await Promise.all(
    defaultComponents.map(c =>
      prisma.payComponent.create({ data: { ...c, description: `${c.name} component`, createdById: userMap['admin@leapfrog.com'] } })
    )
  )
  const compMap = Object.fromEntries(componentRecords.map(c => [c.code, c.id]))
  console.log(`  Created ${componentRecords.length} pay components`)

  // Create default pay rules for DSA roles
  const kpiAllowanceId = compMap['KPI_ALLOWANCE']
  const transportAllowanceId = compMap['TRANSPORT_ALLOWANCE']
  const adjustmentId = compMap['ADJUSTMENT']
  const salesCommissionId = compMap['SALES_COMMISSION']

  if (kpiAllowanceId && transportAllowanceId && adjustmentId && salesCommissionId) {
    const rules = [
      {
        componentId: transportAllowanceId,
        name: 'DSA Transport Allowance',
        description: 'Transport allowance for DSA roles — 1,500 birr flat when sales >= 40%, 0 below',
        employeeCategory: 'SHOP_FIELD' as const,
        role: 'DSA' as const,
        ruleType: 'THRESHOLD' as const,
        calculationMethod: 'THRESHOLD' as const,
        baseAmount: 1500,
        percentageRate: null,
        maxAmount: 1500,
        minAmount: 0,
        thresholdValue: 40,
        thresholdMetric: 'SALES_ACHIEVEMENT_PERCENT' as const,
        effectiveFrom: new Date('2024-01-01'),
        status: 'ACTIVE' as const,
        priority: 10,
      },
      {
        componentId: kpiAllowanceId,
        name: 'DSA KPI Allowance',
        description: 'Performance-based KPI allowance for DSA roles — tiered flat amounts',
        employeeCategory: 'SHOP_FIELD' as const,
        role: 'DSA' as const,
        ruleType: 'TIERED' as const,
        calculationMethod: 'TIERED' as const,
        maxAmount: 2000,
        minAmount: 0,
        tierConfigJson: JSON.stringify([
          { min: 60, amount: 2000 },
          { min: 40, amount: 1000 },
          { min: 0, amount: 0 },
        ]),
        effectiveFrom: new Date('2024-01-01'),
        status: 'ACTIVE' as const,
        priority: 10,
      },
      {
        componentId: adjustmentId,
        name: 'Manual Adjustment',
        description: 'Manual payroll adjustment requiring approval',
        ruleType: 'MANUAL_INPUT' as const,
        calculationMethod: 'MANUAL_INPUT' as const,
        requiresManualInput: true,
        requiresApproval: true,
        effectiveFrom: new Date('2024-01-01'),
        status: 'ACTIVE' as const,
        priority: 0,
      },
      {
        componentId: salesCommissionId,
        name: 'DSA Sales Commission',
        description: 'Tiered sales commission structure for DSA',
        employeeCategory: 'SHOP_FIELD' as const,
        role: 'DSA' as const,
        ruleType: 'TIERED' as const,
        calculationMethod: 'TIERED' as const,
        maxAmount: 5000,
        minAmount: 0,
        tierConfigJson: JSON.stringify([
          { min: 100, percent: 5, amount: 5000 },
          { min: 80, percent: 3, amount: 3000 },
          { min: 50, percent: 1, amount: 1000 },
          { min: 0, percent: 0, amount: 0 },
        ]),
        effectiveFrom: new Date('2024-01-01'),
        status: 'DRAFT' as const,
        priority: 10,
      },
    ]
    await prisma.payRule.createMany({
      data: rules.map(r => ({ ...r, createdById: userMap['admin@leapfrog.com'] })),
    })
    console.log(`  Created ${rules.length} pay rules`)
  }

  // Create default payroll input types
  const defaultInputTypes = [
    { code: 'TRANSPORT_ALLOWANCE_INPUT', name: 'Transport Allowance', category: 'TRANSPORT' as const, valueType: 'AMOUNT' as const, defaultAmount: 0 },
    { code: 'KPI_ACHIEVEMENT_PERCENT', name: 'KPI Achievement %', category: 'KPI' as const, valueType: 'PERCENTAGE' as const },
    { code: 'SALES_COMMISSION_INPUT', name: 'Sales Commission', category: 'COMMISSION' as const, valueType: 'AMOUNT' as const, defaultAmount: 0 },
    { code: 'OVERTIME_HOURS', name: 'Overtime Hours', category: 'OVERTIME' as const, valueType: 'NUMBER' as const, defaultAmount: 0 },
    { code: 'MANUAL_ALLOWANCE', name: 'Manual Allowance', category: 'ALLOWANCE' as const, valueType: 'AMOUNT' as const, defaultAmount: 0, requiresApproval: true },
    { code: 'MANUAL_DEDUCTION', name: 'Manual Deduction', category: 'DEDUCTION' as const, valueType: 'AMOUNT' as const, defaultAmount: 0, requiresApproval: true },
    { code: 'ABSENCE_DAYS', name: 'Absence Days', category: 'ADJUSTMENT' as const, valueType: 'NUMBER' as const, defaultAmount: 0 },
    { code: 'OTHER_ADJUSTMENT', name: 'Other Adjustment', category: 'ADJUSTMENT' as const, valueType: 'AMOUNT' as const, defaultAmount: 0, requiresApproval: true },
  ]
  for (const it of defaultInputTypes) {
    await prisma.payrollInputType.create({
      data: { ...it, description: `${it.name} input type`, createdById: userMap['admin@leapfrog.com'] },
    })
  }
  console.log(`  Created ${defaultInputTypes.length} default payroll input types`)

  console.log('\nSeed complete!')
  console.log('Demo users (password: Test123!):')
  for (const u of ALL_USERS) {
    console.log(`  ${u.email} - ${u.roles.join(', ')}`)
  }
}

main()
  .catch(e => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
