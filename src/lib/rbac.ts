import { prisma } from './prisma'

export type PermissionKey =
  | 'employee.view'
  | 'employee.create'
  | 'employee.edit'
  | 'employee.delete'
  | 'employee.status_change'
  | 'org.view'
  | 'org.edit'
  | 'user.manage'
  | 'role.manage'
  | 'leave.view'
  | 'leave.approve'
  | 'leave.manage'
  | 'evaluation.create'
  | 'evaluation.view'
  | 'evaluation.approve'
  | 'evaluation.manage'
  | 'disciplinary.create'
  | 'disciplinary.approve'
  | 'disciplinary.manage'
  | 'termination.create'
  | 'termination.approve'
  | 'termination.manage'
  | 'transfer.create'
  | 'transfer.approve'
  | 'transfer.manage'
  | 'promotion.create'
  | 'promotion.approve'
  | 'promotion.manage'
  | 'salary.view'
  | 'salary.edit'
  | 'salary.approve'
  | 'commission.view'
  | 'commission.calculate'
  | 'commission.approve'
  | 'payroll.view'
  | 'payroll.manage'
  | 'payroll.approve'
  | 'payroll.export'
  | 'payroll.lock'
  | 'report.view'
  | 'report.export'
  | 'audit.view'
  | 'document.view'
  | 'document.upload'
  | 'document.manage'
  | 'self_service.leave'
  | 'self_service.document_upload'
  | 'self_service.profile_edit'
  | 'settings.view'
  | 'settings.edit'
  | 'data_quality.view'
  | 'data_quality.resolve'
  | 'notification.view'

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
      keys.add(rp.permission.key as PermissionKey)
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
