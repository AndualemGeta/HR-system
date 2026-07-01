import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'
import { initializeChecklist } from '@/lib/phase-control'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'phaseControl.update'))) return forbidden()

    await initializeChecklist()
    return success({ message: 'Checklist initialized' })
  } catch { return internalError() }
}
