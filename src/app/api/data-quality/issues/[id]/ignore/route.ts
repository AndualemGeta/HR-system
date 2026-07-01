import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest } from '@/lib/api'
import { ignoreDataQualityIssue } from '@/lib/data-quality'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return unauthorized()
  if (!(await userHasPermission(session.userId, 'dataQuality.manage'))) return forbidden()

  const body = await req.json()
  if (!body.reason) return badRequest('Reason is required')

  const issue = await prisma.dataQualityIssue.findUnique({ where: { id } })
  if (!issue) return notFound('Issue not found')

  const updated = await ignoreDataQualityIssue(id, body.reason, session.userId)
  return success(updated)
}
