import { prisma } from './prisma'

export interface PayrollReadinessResult {
  employeeId: string
  employeeRecordId: string
  fullName: string
  role: string | null
  department: string | null
  shop: string | null
  region: string | null
  area: string | null
  employmentStatus: string | null
  employeeCategory: string | null
  basicSalaryStatus: 'COMPLETE' | 'MISSING' | 'INVALID'
  paymentInfoStatus: 'COMPLETE' | 'MISSING'
  taxInfoStatus: 'COMPLETE' | 'MISSING'
  pensionInfoStatus: 'COMPLETE' | 'MISSING'
  assignmentStatus: 'COMPLETE' | 'MISSING'
  managerStatus: 'COMPLETE' | 'MISSING' | 'NOT_REQUIRED'
  overallStatus: 'READY' | 'WARNING' | 'NOT_READY' | 'INACTIVE'
  readinessPercentage: number
  blockers: string[]
  warnings: string[]
}

export async function getPayrollReadiness(employeeId: string): Promise<PayrollReadinessResult | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { payrollProfile: true },
  })
  if (!employee) return null

  const [department, shop, region, area] = await Promise.all([
    employee.currentDepartmentId ? prisma.department.findUnique({ where: { id: employee.currentDepartmentId }, select: { name: true } }) : null,
    employee.currentShopId ? prisma.location.findUnique({ where: { id: employee.currentShopId }, select: { name: true } }) : null,
    employee.currentRegionId ? prisma.location.findUnique({ where: { id: employee.currentRegionId }, select: { name: true } }) : null,
    employee.currentAreaId ? prisma.location.findUnique({ where: { id: employee.currentAreaId }, select: { name: true } }) : null,
  ])

  const blockers: string[] = []
  const warnings: string[] = []

  const basicSalaryStatus = employee.basicSalary ? 'COMPLETE' : 'MISSING'
  if (basicSalaryStatus === 'MISSING') blockers.push('Basic salary is missing')

  const hasPaymentInfo = employee.payrollProfile && (employee.payrollProfile.bankAccountNumber || employee.payrollProfile.mpesaAccount)
  const paymentInfoStatus = hasPaymentInfo ? 'COMPLETE' : 'MISSING'
  if (paymentInfoStatus === 'MISSING') blockers.push('Payment account (bank or M-PESA) is missing')

  const hasPaymentMethod = employee.payrollProfile?.paymentMethod
  if (!hasPaymentMethod) blockers.push('Payment method is missing')

  const taxInfoStatus = employee.payrollProfile?.taxId ? 'COMPLETE' : 'MISSING'
  if (taxInfoStatus === 'MISSING') warnings.push('Tax ID is missing')

  const pensionInfoStatus = employee.payrollProfile?.pensionId ? 'COMPLETE' : 'MISSING'
  if (pensionInfoStatus === 'MISSING') warnings.push('Pension ID is missing')

  const hasAssignment = employee.currentRole && employee.employeeCategory
  const assignmentStatus = hasAssignment ? 'COMPLETE' : 'MISSING'
  if (assignmentStatus === 'MISSING') blockers.push('Employee category or role is not assigned')

  const needsManager = !['CEO', 'CLEANING_STAFF', 'SECURITY_STAFF'].includes(employee.currentRole || '')
  const hasManager = !!employee.directManagerId
  const managerStatus = !needsManager ? 'NOT_REQUIRED' : hasManager ? 'COMPLETE' : 'MISSING'
  if (managerStatus === 'MISSING') blockers.push('Direct manager is missing')

  if (!employee.employeeCategory) blockers.push('Employee category is missing')
  if (employee.employeeCategory === 'HEAD_OFFICE' && !employee.currentDepartmentId) {
    blockers.push('Head Office employee must have a department')
  }
  if (employee.employeeCategory === 'SHOP_FIELD' && !employee.currentShopId && ['SHOP_MANAGER', 'DSP', 'DSA', 'SHOP_ACCOUNTANT'].includes(employee.currentRole || '')) {
    blockers.push(`${employee.currentRole} must have a shop`)
  }
  if (employee.currentRole === 'SHOP_ACCOUNTANT' && !employee.accountingReportingManagerId) {
    blockers.push('Shop Accountant must have an accounting reporting manager')
  }

  if (!employee.payrollProfile?.costCenter) warnings.push('Cost center is missing')

  const isInactive = ['RESIGNED', 'TERMINATED', 'EXITED', 'INACTIVE'].includes(employee.employmentStatus || '')
  if (isInactive) warnings.push('Employee is not active')

  let overallStatus: PayrollReadinessResult['overallStatus'] = 'READY'
  if (isInactive) overallStatus = 'INACTIVE'
  else if (blockers.length > 0) overallStatus = 'NOT_READY'
  else if (warnings.length > 0) overallStatus = 'WARNING'

  const totalChecks = 8
  const passedChecks = [
    basicSalaryStatus === 'COMPLETE',
    paymentInfoStatus === 'COMPLETE',
    hasPaymentMethod,
    taxInfoStatus === 'COMPLETE',
    pensionInfoStatus === 'COMPLETE',
    assignmentStatus === 'COMPLETE',
    managerStatus === 'COMPLETE' || managerStatus === 'NOT_REQUIRED',
    !!employee.employeeCategory,
  ].filter(Boolean).length

  const readinessPercentage = Math.round((passedChecks / totalChecks) * 100)

  return {
    employeeId: employee.employeeId,
    employeeRecordId: employee.id,
    fullName: employee.fullName,
    role: employee.currentRole,
    department: department?.name || null,
    shop: shop?.name || null,
    region: region?.name || null,
    area: area?.name || null,
    employmentStatus: employee.employmentStatus,
    employeeCategory: employee.employeeCategory,
    basicSalaryStatus,
    paymentInfoStatus,
    taxInfoStatus,
    pensionInfoStatus,
    assignmentStatus,
    managerStatus,
    overallStatus,
    readinessPercentage,
    blockers,
    warnings,
  }
}

export async function getPayrollReadinessList(filters: {
  departmentId?: string
  regionId?: string
  areaId?: string
  shopId?: string
  role?: string
  employmentStatus?: string
  readinessStatus?: string
  scopeWhere?: Record<string, unknown>
}): Promise<PayrollReadinessResult[]> {
  const where: Record<string, unknown> = {}
  if (filters.departmentId) where.currentDepartmentId = filters.departmentId
  if (filters.regionId) where.currentRegionId = filters.regionId
  if (filters.areaId) where.currentAreaId = filters.areaId
  if (filters.shopId) where.currentShopId = filters.shopId
  if (filters.role) where.currentRole = filters.role
  if (filters.employmentStatus) where.employmentStatus = filters.employmentStatus

  if (filters.scopeWhere && Object.keys(filters.scopeWhere).length > 0) {
    where.AND = [where.AND, filters.scopeWhere].filter(Boolean)
  }

  const employees = await prisma.employee.findMany({ where, select: { id: true } })
  const results: PayrollReadinessResult[] = []

  for (const emp of employees) {
    const readiness = await getPayrollReadiness(emp.id)
    if (!readiness) continue
    if (filters.readinessStatus && readiness.overallStatus !== filters.readinessStatus) continue
    results.push(readiness)
  }

  return results
}
