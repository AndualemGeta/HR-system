import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest } from '@/lib/api'
import { rejectRuleApproval } from '@/lib/salary-rule-approvals'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryRuleApproval.reject'))) return forbidden()

    const body = await req.json()
    if (!body.comment) return badRequest('Rejection comment is required')

    const updated = await rejectRuleApproval(id, session.userId, body.comment)
    return success(updated)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return badRequest(msg)
  }
}
