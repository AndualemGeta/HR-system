import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, badRequest, success, forbidden } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { userHasPermission } from '@/lib/rbac'
import { buildEmployeeScopeWhere } from '@/lib/rbac'
import { PAGINATION_DEFAULT_PAGE, PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, EMPLOYEE_ID_PREFIX } from '@/lib/constants'
import { employeeCreateSchema } from '@/lib/date-validator'

const onboardingItemDefs = [
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

async function getNextEmployeeId(): Promise<string> {
  const last = await prisma.employee.findFirst({
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  })
  if (!last) return `${EMPLOYEE_ID_PREFIX}_0001`
  const num = parseInt(last.employeeId.split('_')[1], 10)
  return `${EMPLOYEE_ID_PREFIX}_${String(num + 1).padStart(4, '0')}`
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || String(PAGINATION_DEFAULT_PAGE)))
  const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULT_LIMIT))))
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const departmentId = searchParams.get('departmentId') || ''
  const category = searchParams.get('category') || ''
  const role = searchParams.get('role') || ''

  // Build the base where clause and then merge scope
  const parsedSession = await (await import('@/lib/session')).getSession()
  if (!parsedSession) return forbidden()

  const scopeWhere = await buildEmployeeScopeWhere(parsedSession.userId)

  const where: Record<string, unknown> = { ...scopeWhere }
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status) where.employmentStatus = status
  if (departmentId) where.currentDepartmentId = departmentId
  if (category) where.employeeCategory = category
  if (role) where.currentRole = role

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { employeeId: 'asc' },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        currentRole: true,
        currentLevel: true,
        employmentStatus: true,
        employmentType: true,
        employeeCategory: true,
        currentDepartmentId: true,
        currentDivisionId: true,
        currentRegionId: true,
        currentAreaId: true,
        currentShopId: true,
        currentClusterId: true,
        directManagerId: true,
        createdAt: true,
      },
    }),
  ])

  return success({ items: employees, total, page, limit, totalPages: Math.ceil(total / limit) })
}, 'employee.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => ({}))
  const parsed = employeeCreateSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const data = parsed.data

  // If salary or KPI fields are present, require salary.update
  if (data.basicSalary !== undefined || data.salaryEffectiveDate !== undefined || data.kpiDefaultAmount !== undefined || data.kpiEffectiveFrom !== undefined) {
    if (!(await userHasPermission(ctx.userId, 'salary.update'))) {
      return forbidden('Salary update permission required to set salary or KPI fields')
    }
  }

  const employeeId = await getNextEmployeeId()
  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
  const status = (data.employmentStatus || 'DRAFT') as never
  const cat = data.employeeCategory as never || null

  // Default direct manager for role-specific rules
  let directManagerId = data.directManagerId || null
  const role = data.currentRole

  if ((role === 'ASM' || role === 'SHOP_MANAGER') && !directManagerId) {
    const salesHead = await prisma.employee.findFirst({ where: { currentRole: 'SALES_HEAD', employmentStatus: 'ACTIVE' } })
    if (salesHead) directManagerId = salesHead.id
  }
  if ((role === 'DSP' || role === 'DSA') && !directManagerId && data.currentShopId) {
    const shopMgr = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_MANAGER', currentShopId: data.currentShopId, employmentStatus: 'ACTIVE' } })
    if (shopMgr) directManagerId = shopMgr.id
  }

  // Default accounting reporting manager for Shop Accountant
  let accountingReportingManagerId = data.accountingReportingManagerId || null
  if (role === 'SHOP_ACCOUNTANT' && !accountingReportingManagerId) {
    const treasuryAcct = await prisma.employee.findFirst({ where: { currentRole: 'TREASURY_MANAGER', employmentStatus: 'ACTIVE' } })
    if (treasuryAcct) accountingReportingManagerId = treasuryAcct.id
    else {
      const hoAcct = await prisma.employee.findFirst({ where: { currentRole: 'ACCOUNTANT', employmentStatus: 'ACTIVE' } })
      if (hoAcct) accountingReportingManagerId = hoAcct.id
    }
  }

  // Category-specific validation (after defaults are set)
  const catErrors: string[] = []
  if (cat === 'HEAD_OFFICE') {
    if (!data.currentDepartmentId) catErrors.push('Department is required for Head Office employees')
    if (!role) catErrors.push('Role/position is required for Head Office employees')
  } else if (cat === 'SHOP_FIELD') {
    if (!data.currentRegionId && !data.currentAreaId) catErrors.push('Region or area is required for Shop/Field employees')
    if (!role) catErrors.push('Role/position is required for Shop/Field employees')
    if (role === 'SHOP_MANAGER' && !data.currentShopId) catErrors.push('Shop is required for Shop Manager')
    if (role === 'DSP' && !data.currentShopId) catErrors.push('Shop is required for DSP')
    if (role === 'DSA' && !data.currentShopId) catErrors.push('Shop is required for DSA')
    if (role === 'SHOP_ACCOUNTANT') {
      if (!data.currentShopId) catErrors.push('Shop is required for Shop Accountant')
      if (!accountingReportingManagerId) catErrors.push('Accounting reporting manager is required for Shop Accountant and no active Treasury Manager or Accountant found')
    }
  }
  if (catErrors.length > 0) return badRequest(catErrors.join('; '))

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        employeeId,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName || null,
        fullName,
        email: data.email || null,
        phoneNumber: data.phoneNumber || null,
        gender: data.gender || 'NOT_SPECIFIED',
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address || null,
        notes: data.notes || null,
        hireDate: data.hireDate ? new Date(data.hireDate) : null,
        employmentType: data.employmentType ? (data.employmentType as never) : null,
        employmentStatus: status,
        employeeCategory: cat,
        currentRole: role ? (role as never) : 'OTHER',
        currentLevel: data.currentLevel ? (data.currentLevel as never) : 'TO_BE_DEFINED',
        currentDepartmentId: data.currentDepartmentId || null,
        currentDivisionId: data.currentDivisionId || null,
        currentRegionId: data.currentRegionId || null,
        currentAreaId: data.currentAreaId || null,
        currentShopId: data.currentShopId || null,
        currentClusterId: data.currentClusterId || null,
        directManagerId,
        accountingReportingManagerId,
        basicSalary: data.basicSalary || null,
        salaryEffectiveDate: data.salaryEffectiveDate ? new Date(data.salaryEffectiveDate) : null,
        createdById: ctx.userId,
      },
    })

    // Create EmployeeSalary history record when basicSalary is supplied
    if (data.basicSalary && data.salaryEffectiveDate) {
      await tx.employeeSalary.create({
        data: {
          employeeId: emp.id,
          basicSalary: data.basicSalary,
          effectiveDate: new Date(data.salaryEffectiveDate),
          reason: 'Initial salary on employee creation',
          createdById: ctx.userId,
        },
      })
    }

    // Create payroll profile if any payroll field is present
    if (data.paymentMethod || data.bankName || data.bankAccountNumber || data.mpesaAccount || data.taxId || data.pensionId || data.payrollGroup) {
      await tx.employeePayrollProfile.create({
        data: {
          employeeId: emp.id,
          paymentMethod: data.paymentMethod || null,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          mpesaAccount: data.mpesaAccount || null,
          taxId: data.taxId || null,
          pensionId: data.pensionId || null,
          payrollGroup: data.payrollGroup ? (data.payrollGroup as import('@prisma/client').$Enums.PayrollGroup) : undefined,
        },
      })
    }

    // Create KPI assignment if both KPI fields supplied
    if (data.kpiDefaultAmount !== undefined && data.kpiEffectiveFrom !== undefined) {
      const kpiComponent = await tx.payComponent.findUnique({ where: { code: 'KPI_ALLOWANCE' } })
      if (!kpiComponent) throw new Error('KPI component not found — cannot create KPI assignment')
      if (!kpiComponent.isActive) throw new Error('KPI component is inactive')
      if (kpiComponent.componentType !== 'KPI') throw new Error('Component is not a KPI type')

      await tx.employeePayComponentAssignment.create({
        data: {
          employeeId: emp.id,
          payComponentId: kpiComponent.id,
          defaultAmount: data.kpiDefaultAmount,
          effectiveFrom: new Date(data.kpiEffectiveFrom),
          isActive: true,
          createdById: ctx.userId,
          updatedById: ctx.userId,
        },
      })
    }

    return emp
  })

  // Auto-create onboarding checklist
  if (status === 'ONBOARDING' || status === 'DRAFT') {
    const checklist = await prisma.onboardingChecklist.create({
      data: { employeeId: employee.id },
    })
    for (const item of onboardingItemDefs) {
      await prisma.onboardingChecklistItem.create({
        data: { checklistId: checklist.id, key: item.key, label: item.label },
      })
    }
  }

  // Auto-create status history
  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: employee.id,
      newStatus: status,
      reason: 'Initial status on creation',
      effectiveDate: new Date(),
      updatedById: ctx.userId,
    },
  })

  // Auto-create assignment
  if (role) {
    await prisma.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        employeeCategory: cat,
        departmentId: data.currentDepartmentId || null,
        divisionId: data.currentDivisionId || null,
        regionId: data.currentRegionId || null,
        areaId: data.currentAreaId || null,
        shopId: data.currentShopId || null,
        clusterId: data.currentClusterId || null,
        role: role as never,
        level: (data.currentLevel as never) || 'TO_BE_DEFINED',
        directManagerId,
        accountingReportingManagerId,
        startDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        reason: 'Initial assignment',
      },
    })
  }

  await createAuditLog({
    userId: ctx.userId,
    action: 'EMPLOYEE_CREATE',
    entityType: 'Employee',
    entityId: employee.id,
    newValue: { employeeId: employee.employeeId, fullName: employee.fullName, role, status, category: cat },
  })

  if (accountingReportingManagerId) {
    await createAuditLog({
      userId: ctx.userId,
      action: 'ACCOUNTING_MANAGER_CHANGE',
      entityType: 'Employee',
      entityId: employee.id,
      newValue: { accountingReportingManagerId },
    })
  }

  return success(employee, 201)
}, 'employee.create')
