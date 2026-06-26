import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const { employeeId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'onboarding.view'))) return forbidden()

    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { employeeId },
      include: { items: true },
    })
    if (!checklist) return notFound()

    return success(checklist)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'onboarding.update'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const { itemId, completed } = body

    if (!itemId) return new Response(JSON.stringify({ error: 'itemId required' }), { status: 400 })

    const item = await prisma.onboardingChecklistItem.findUnique({ where: { id: itemId } })
    if (!item) return notFound()

    const updatedItem = await prisma.onboardingChecklistItem.update({
      where: { id: itemId },
      data: { completed: !!completed, completedById: session.userId, completedAt: completed ? new Date() : null },
    })

    const allItems = await prisma.onboardingChecklistItem.findMany({ where: { checklistId: item.checklistId } })
    const allDone = allItems.every(i => i.completed)
    if (allDone) {
      await prisma.onboardingChecklist.update({
        where: { id: item.checklistId },
        data: { status: 'APPROVED', completedAt: new Date() },
      })
    }

    await createAuditLog({
      userId: session.userId,
      action: 'OTHER',
      entityType: 'OnboardingChecklistItem',
      entityId: itemId,
      oldValue: { completed: item.completed },
      newValue: { completed: !!completed },
    })

    return success(updatedItem)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
