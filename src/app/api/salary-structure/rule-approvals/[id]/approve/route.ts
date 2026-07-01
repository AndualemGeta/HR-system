import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest } from '@/lib/api'
import { approveRuleApproval } from '@/lib/salary-rule-approvals'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryRuleApproval.approve'))) return forbidden()

    await approveRuleApproval(id, session.userId)
    return success({ message: 'Approval processed' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return badRequest(msg)
  }
}
