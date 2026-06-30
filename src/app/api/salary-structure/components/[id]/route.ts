import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.view'))) return forbidden()

    const component = await prisma.payComponent.findUnique({ where: { id } })
    if (!component) return notFound('Component not found')
    return success(component)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.manageComponents'))) return forbidden()

    const component = await prisma.payComponent.findUnique({ where: { id } })
    if (!component) return notFound('Component not found')

    const body = await req.json()
    const { name, description, componentType, taxTreatment, isEarning, isDeduction, isStatutory, isVariable } = body

    const updated = await prisma.payComponent.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(componentType !== undefined && { componentType }),
        ...(taxTreatment !== undefined && { taxTreatment }),
        ...(isEarning !== undefined && { isEarning }),
        ...(isDeduction !== undefined && { isDeduction }),
        ...(isStatutory !== undefined && { isStatutory }),
        ...(isVariable !== undefined && { isVariable }),
        updatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAY_COMPONENT_UPDATE',
      entityType: 'PayComponent',
      entityId: id,
      oldValue: { name: component.name, componentType: component.componentType },
      newValue: { name: updated.name, componentType: updated.componentType },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
