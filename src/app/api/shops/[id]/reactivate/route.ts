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
    if (!(await userHasPermission(session.userId, 'shop.reactivate'))) return forbidden()
    if (!(await shopInUserScope(session.userId, id))) return forbidden()

    const shop = await prisma.location.findUnique({ where: { id } })
    if (!shop || shop.type !== 'SHOP') return notFound('Shop not found')
    if (shop.isActive) return badRequest('Shop is already active')

    await prisma.location.update({ where: { id }, data: { isActive: true } })

    await createAuditLog({
      userId: session.userId, action: 'SHOP_REACTIVATE', entityType: 'Location',
      entityId: id, oldValue: { isActive: false }, newValue: { isActive: true },
    })

    return success({ id, isActive: true })
  } catch (err) { console.error(err); return internalError() }
}
