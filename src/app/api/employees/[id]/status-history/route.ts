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

    return success(history)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
