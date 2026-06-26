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
