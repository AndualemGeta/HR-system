import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.importHistory'))) return forbidden()

    const sessions = await prisma.importSession.findMany({
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return success(sessions)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
