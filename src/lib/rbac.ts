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
  | 'reports.view'
  | 'audit.view'
  | 'user.view'
  | 'user.manage'
  | 'role.view'
  | 'role.manage'
  | 'organization.view'
  | 'organization.manage'

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
  'reports.view': true,
  'audit.view': true,
  'user.view': true,
  'user.manage': true,
  'role.view': true,
  'role.manage': true,
  'organization.view': true,
  'organization.manage': true,
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
