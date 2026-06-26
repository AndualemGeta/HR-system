import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { notFound, success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'onboarding.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { employeeId: id },
      include: { items: true },
    })
    if (!checklist) return notFound()

    return success(checklist)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
