import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest } from '@/lib/api'
import { requestRuleDeactivation } from '@/lib/salary-rule-approvals'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryRuleApproval.request'))) return forbidden()

    const body = await req.json()
    const request = await requestRuleDeactivation(id, session.userId, body.reason)
    return success({ message: 'Deactivation request submitted for approval', request }, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return badRequest(msg)
  }
}
