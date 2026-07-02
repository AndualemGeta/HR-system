import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/shop-scope'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.deactivate'))) return forbidden()
    if (!(await shopInUserScope(session.userId, id))) return forbidden()

    const shop = await prisma.location.findUnique({ where: { id } })
    if (!shop || shop.type !== 'SHOP') return notFound('Shop not found')
    if (!shop.isActive) return badRequest('Shop is already inactive')

    await prisma.location.update({ where: { id }, data: { isActive: false } })

    await createAuditLog({
      userId: session.userId, action: 'SHOP_DEACTIVATE', entityType: 'Location',
      entityId: id, oldValue: { isActive: true }, newValue: { isActive: false },
    })

    return success({ id, isActive: false })
  } catch (err) { console.error(err); return internalError() }
}
