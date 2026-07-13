import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.manageInputConfig'))) return forbidden()

    const body = await req.json().catch(() => ({}))

    // Support both { items: [{ id, displayOrder }] } and { orders: { id: order } }
    let items: { id: string; displayOrder: number }[]
    if (body.items) {
      items = body.items
    } else if (body.orders) {
      items = Object.entries(body.orders).map(([id, order]) => ({ id, displayOrder: Number(order) }))
    } else {
      return badRequest('Invalid input — expected { items: [...] } or { orders: { ... } }')
    }

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('No items to reorder')
    }

    await prisma.$transaction(
      items.map(item =>
        prisma.shopManagerIncentiveInputConfig.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    )

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_UPDATE',
      entityType: 'ShopManagerIncentiveInputConfig',
      newValue: { reorder: items },
    })

    return success({ reordered: items.length })
  } catch (err) { console.error(err); return internalError() }
}
