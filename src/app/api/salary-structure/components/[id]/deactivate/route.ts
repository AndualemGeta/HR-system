import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.manageComponents'))) return forbidden()

    const component = await prisma.payComponent.findUnique({ where: { id } })
    if (!component) return notFound('Component not found')

    const updated = await prisma.payComponent.update({
      where: { id },
      data: { isActive: false, updatedById: session.userId },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAY_COMPONENT_DEACTIVATE',
      entityType: 'PayComponent',
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
