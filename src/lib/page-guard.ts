import { redirect } from 'next/navigation'
import { getSession } from './session'
import { userHasPermission, type PermissionKey } from './rbac'

export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requirePagePermission(permission: PermissionKey) {
  const session = await requireAuth()
  const has = await userHasPermission(session.userId, permission)
  if (!has) redirect('/dashboard')
  return session
}

export async function requireAnyPagePermission(permissions: PermissionKey[]) {
  const session = await requireAuth()
  for (const p of permissions) {
    if (await userHasPermission(session.userId, p)) return session
  }
  redirect('/dashboard')
}
