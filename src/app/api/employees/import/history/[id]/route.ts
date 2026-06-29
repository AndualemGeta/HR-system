import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.importHistory'))) return forbidden()

    const importSession = await prisma.importSession.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        rows: { orderBy: { rowNumber: 'asc' } },
      },
    })
    if (!importSession) return notFound()

    return success(importSession)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
