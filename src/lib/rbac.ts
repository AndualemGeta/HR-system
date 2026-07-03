import { prisma } from './prisma'

export type PermissionKey =
  | 'employee.view'
  | 'employee.create'
  | 'employee.update'
  | 'employee.delete'
  | 'salary.view'
  | 'salary.update'
  | 'status.view'
  | 'status.update'
  | 'assignment.view'
  | 'assignment.update'
  | 'onboarding.view'
  | 'onboarding.update'
  | 'onboarding.complete'
  | 'reports.view'
  | 'audit.view'
  | 'user.view'
  | 'user.manage'
  | 'role.view'
  | 'role.manage'
  | 'organization.view'
  | 'organization.manage'
  | 'document.view'
  | 'document.upload'
  | 'document.download'
  | 'document.deactivate'
  | 'document.manageRules'
  | 'employee.import'
  | 'employee.importPreview'
  | 'employee.importConfirm'
  | 'employee.importHistory'
  | 'employee.payrollReadiness.view'
  | 'employee.payrollReadiness.export'
  | 'salaryStructure.view'
  | 'salaryStructure.manageComponents'
  | 'salaryStructure.manageRules'
  | 'salaryStructure.preview'
  | 'salaryStructure.activateRule'
  | 'salaryStructure.deactivateRule'
  | 'salaryStructure.auditView'
  | 'dataQuality.view'
  | 'dataQuality.manage'
  | 'dataQuality.export'
  | 'changeRequest.view'
  | 'changeRequest.create'
  | 'changeRequest.approve'
  | 'changeRequest.reject'
  | 'changeRequest.cancel'
  | 'salaryRuleApproval.view'
  | 'salaryRuleApproval.request'
  | 'salaryRuleApproval.approve'
  | 'salaryRuleApproval.reject'
  | 'phaseControl.view'
  | 'phaseControl.update'
  | 'payrollPeriod.view'
  | 'payrollPeriod.create'
  | 'payrollPeriod.update'
  | 'payrollPeriod.open'
  | 'payrollPeriod.close'
  | 'payrollPeriod.cancel'
  | 'payrollInputType.view'
  | 'payrollInputType.manage'
  | 'payrollInput.view'
  | 'payrollInput.create'
  | 'payrollInput.submit'
  | 'payrollInput.review'
  | 'payrollInput.import'
  | 'payrollInput.export'
  | 'payrollInput.lock'
  | 'payrollInput.unlock'
  | 'payrollInputRequirement.view'
  | 'payrollInputRequirement.manage'
  | 'payrollInputWaiver.view'
  | 'payrollInputWaiver.create'
  | 'payrollInputWaiver.deactivate'
  | 'payrollPeriod.review'
  | 'payrollPeriod.markReadyForCalculation'
  |   'payrollPreparationSummary.view'
  | 'payrollPreparationSummary.export'
  | 'shop.view'
  | 'shop.create'
  | 'shop.update'
  | 'shop.deactivate'
  | 'shop.reactivate'
  | 'shop.assignManager'
  | 'shop.updateCriteria'
  | 'shop.viewCriteriaHistory'
  | 'shopManagerIncentive.view'
  | 'shopManagerIncentive.createPeriod'
  | 'shopManagerIncentive.updatePeriod'
  | 'shopManagerIncentive.input'
  | 'shopManagerIncentive.import'
  | 'shopManagerIncentive.calculate'
  | 'shopManagerIncentive.review'
  | 'shopManagerIncentive.approve'
  | 'shopManagerIncentive.lock'
  | 'shopManagerIncentive.export'
  | 'shopManagerIncentive.sendToPayroll'

export async function getUserPermissions(userId: string): Promise<PermissionKey[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  })

  const keys = new Set<PermissionKey>()
  for (const ur of roles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission.key in ALL_PERMISSIONS_MAP) {
        keys.add(rp.permission.key as PermissionKey)
      }
    }
  }
  return Array.from(keys)
}

export async function userHasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.includes(permission)
}

export async function userHasAnyPermission(userId: string, permissions: PermissionKey[]): Promise<boolean> {
  const userPerms = await getUserPermissions(userId)
  return permissions.some(p => userPerms.includes(p))
}

export async function userHasAllPermissions(userId: string, permissions: PermissionKey[]): Promise<boolean> {
  const userPerms = await getUserPermissions(userId)
  return permissions.every(p => userPerms.includes(p))
}

const ALL_PERMISSIONS_MAP: Record<string, boolean> = {
  'employee.view': true,
  'employee.create': true,
  'employee.update': true,
  'employee.delete': true,
  'salary.view': true,
  'salary.update': true,
  'status.view': true,
  'status.update': true,
  'assignment.view': true,
  'assignment.update': true,
  'onboarding.view': true,
  'onboarding.update': true,
  'onboarding.complete': true,
  'reports.view': true,
  'audit.view': true,
  'user.view': true,
  'user.manage': true,
  'role.view': true,
  'role.manage': true,
  'organization.view': true,
  'organization.manage': true,
  'document.view': true,
  'document.upload': true,
  'document.download': true,
  'document.deactivate': true,
  'document.manageRules': true,
  'employee.import': true,
  'employee.importPreview': true,
  'employee.importConfirm': true,
  'employee.importHistory': true,
  'employee.payrollReadiness.view': true,
  'employee.payrollReadiness.export': true,
  'salaryStructure.view': true,
  'salaryStructure.manageComponents': true,
  'salaryStructure.manageRules': true,
  'salaryStructure.preview': true,
  'salaryStructure.activateRule': true,
  'salaryStructure.deactivateRule': true,
  'salaryStructure.auditView': true,
  'dataQuality.view': true,
  'dataQuality.manage': true,
  'dataQuality.export': true,
  'changeRequest.view': true,
  'changeRequest.create': true,
  'changeRequest.approve': true,
  'changeRequest.reject': true,
  'changeRequest.cancel': true,
  'salaryRuleApproval.view': true,
  'salaryRuleApproval.request': true,
  'salaryRuleApproval.approve': true,
  'salaryRuleApproval.reject': true,
  'phaseControl.view': true,
  'phaseControl.update': true,
  'payrollPeriod.view': true,
  'payrollPeriod.create': true,
  'payrollPeriod.update': true,
  'payrollPeriod.open': true,
  'payrollPeriod.close': true,
  'payrollPeriod.cancel': true,
  'payrollInputType.view': true,
  'payrollInputType.manage': true,
  'payrollInput.view': true,
  'payrollInput.create': true,
  'payrollInput.submit': true,
  'payrollInput.review': true,
  'payrollInput.import': true,
  'payrollInput.export': true,
  'payrollInput.lock': true,
  'payrollInput.unlock': true,
  'payrollInputRequirement.view': true,
  'payrollInputRequirement.manage': true,
  'payrollInputWaiver.view': true,
  'payrollInputWaiver.create': true,
  'payrollInputWaiver.deactivate': true,
  'payrollPeriod.review': true,
  'payrollPeriod.markReadyForCalculation': true,
  'payrollPreparationSummary.view': true,
  'payrollPreparationSummary.export': true,
  'shop.view': true,
  'shop.create': true,
  'shop.update': true,
  'shop.deactivate': true,
  'shop.reactivate': true,
  'shop.assignManager': true,
  'shop.updateCriteria': true,
  'shop.viewCriteriaHistory': true,
  'shopManagerIncentive.view': true,
  'shopManagerIncentive.createPeriod': true,
  'shopManagerIncentive.updatePeriod': true,
  'shopManagerIncentive.input': true,
  'shopManagerIncentive.import': true,
  'shopManagerIncentive.calculate': true,
  'shopManagerIncentive.review': true,
  'shopManagerIncentive.approve': true,
  'shopManagerIncentive.lock': true,
  'shopManagerIncentive.export': true,
  'shopManagerIncentive.sendToPayroll': true,
}

export const ALL_PERMISSIONS = Object.keys(ALL_PERMISSIONS_MAP)


/**
 * Build a Prisma `where` clause to enforce manager/role reporting scope.
 * Users with unlimited scope (SUPER_ADMIN, HR_ADMIN, HR_OFFICER, FINANCE*) return an empty clause.
 */
export async function buildEmployeeScopeWhere(userId: string): Promise<Record<string, unknown>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
    },
  })
  if (!user) return { id: null } // no employees visible

  const roleNames = user.roles.map(r => r.role.name)
  // Unlimited roles
  if (roleNames.some(r => ['SUPER_ADMIN', 'HR_ADMIN', 'HR_OFFICER', 'FINANCE_DIRECTOR', 'FINANCE_PAYROLL', 'TREASURY_MANAGER', 'ACCOUNTANT', 'AUDITOR'].includes(r))) {
    return {}
  }

  // SALES_HEAD can view Shop/Field employees
  if (roleNames.includes('SALES_HEAD')) {
    return { employeeCategory: 'SHOP_FIELD' }
  }

  // ASM: employees in their area or assigned shops
  if (roleNames.includes('ASM')) {
    const empRecord = user.employeeId ? await prisma.employee.findUnique({ where: { id: user.employeeId } }) : null
    if (!empRecord) return { id: null }
    const areaId = empRecord.currentAreaId
    if (!areaId) return { id: null }
    return {
      OR: [
        { currentAreaId: areaId },
        { currentRegionId: areaId },
        { directManagerId: empRecord.id },
        { id: empRecord.id },
      ],
    }
  }

  // SHOP_MANAGER: employees in their shop
  if (roleNames.includes('SHOP_MANAGER')) {
    const empRecord = user.employeeId ? await prisma.employee.findUnique({ where: { id: user.employeeId } }) : null
    if (!empRecord || !empRecord.currentShopId) return { id: null }
    return {
      OR: [
        { currentShopId: empRecord.currentShopId },
        { directManagerId: empRecord.id },
        { id: empRecord.id },
      ],
    }
  }

  // EMPLOYEE: own profile only
  if (roleNames.includes('EMPLOYEE')) {
    if (!user.employeeId) return { id: null }
    return { id: user.employeeId }
  }

  return { id: null }
}

/**
 * Check whether a user is allowed to view a specific employee.
 */
export async function canViewEmployee(userId: string, employeeId: string): Promise<boolean> {
  const scopeWhere = await buildEmployeeScopeWhere(userId)
  if (Object.keys(scopeWhere).length === 0) return true // unlimited
  const count = await prisma.employee.count({ where: { ...scopeWhere, id: employeeId } })
  return count > 0
}
