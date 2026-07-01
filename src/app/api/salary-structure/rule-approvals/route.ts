import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryRuleApproval.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const where: Record<string, unknown> = {}
    if (searchParams.get('status')) where.status = searchParams.get('status')
    if (searchParams.get('ruleId')) where.ruleId = searchParams.get('ruleId')

    const requests = await prisma.salaryRuleApprovalRequest.findMany({
      where: where as any,
      include: { rule: { select: { name: true, componentId: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return success(requests)
  } catch { return internalError() }
}
