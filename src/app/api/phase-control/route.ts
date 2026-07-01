import { type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { getChecklist, updateChecklistItem } from '@/lib/phase-control'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'phaseControl.view'))) return forbidden()

    const checklist = await getChecklist()
    return success(checklist)
  } catch { return internalError() }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'phaseControl.update'))) return forbidden()

    const body = await req.json()
    if (!body.id || !body.status) return badRequest('id and status are required')

    const updated = await updateChecklistItem(body.id, body.status, body.comment || null, session.userId)
    return success(updated)
  } catch { return internalError() }
}
