import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'statutoryReport.view'))) return forbidden()
    const { id } = await params
    const report = await prisma.payrollStatutoryReport.findUnique({ where: { id } })
    if (!report) return notFound()
    return success(report)
  } catch (e) { console.error(e); return internalError() }
}
