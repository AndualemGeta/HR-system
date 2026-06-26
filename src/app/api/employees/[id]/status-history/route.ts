import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'status.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const history = await prisma.employeeStatusHistory.findMany({
      where: { employeeId: id },
      orderBy: { effectiveDate: 'desc' },
    })

    // Resolve updater names
    const userIds = history.map(h => h.updatedById).filter(Boolean) as string[]
    const users = userIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : []
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))
    const enriched = history.map(h => ({
      ...h,
      updatedByName: h.updatedById ? userMap[h.updatedById] || null : null,
    }))

    return success(enriched)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
