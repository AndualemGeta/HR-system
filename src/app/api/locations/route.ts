import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'
import { buildShopScopeWhere } from '@/lib/shop-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const canViewOrg = await userHasPermission(session.userId, 'organization.view')
    const canViewShop = await userHasPermission(session.userId, 'shop.view')
    if (!canViewOrg && !canViewShop) return forbidden()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const parentId = searchParams.get('parentId')

    const where: Record<string, unknown> = { isActive: true }

    if (type === 'SHOP') {
      if (!canViewShop) return forbidden()
      const scopeWhere = await buildShopScopeWhere(session.userId)
      Object.assign(where, scopeWhere)
    } else {
      if (!canViewOrg) return forbidden()
    }

    if (type) where.type = type
    if (parentId) where.parentId = parentId

    const locations = await prisma.location.findMany({
      where,
      select: { id: true, name: true, code: true, type: true, parentId: true },
      orderBy: { name: 'asc' },
    })

    return success(locations)
  } catch (err) { console.error(err); return internalError() }
}
