import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, internalError, conflict } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { buildShopScopeWhere } from '@/lib/shop-scope'

const createSchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().min(1, 'code is required'),
  regionId: z.string().optional(),
  areaId: z.string().optional(),
  clusterId: z.string().optional(),
  shopManagerId: z.string().optional(),
  corridorType: z.enum(['CORRIDOR', 'NON_CORRIDOR', 'UNKNOWN']).optional(),
  isIncentiveEligible: z.boolean().optional(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.view'))) return forbidden()

    const scopeWhere = await buildShopScopeWhere(session.userId)
    const shops = await prisma.location.findMany({
      where: { ...scopeWhere, type: 'SHOP' },
      include: {
        parent: { select: { id: true, name: true, code: true, type: true, parentId: true, parent: { select: { id: true, name: true, code: true, type: true } } } },
        shopProfile: {
          include: {
            defaultShopManager: { select: { id: true, employeeId: true, fullName: true } },
          },
        },
        children: { where: { type: 'SHOP' }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    })

    const results = await Promise.all(shops.map(async (shop) => {
      const currentCriteria = await prisma.shopCriteriaStatusHistory.findFirst({
        where: { shopLocationId: shop.id, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      })
      return { ...shop, currentCriteria: currentCriteria?.criteria ?? 'UNASSIGNED' }
    }))

    return success(results)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.create'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { name, code, regionId, areaId, clusterId, shopManagerId, corridorType, isIncentiveEligible } = parsed.data

    if (!regionId && !areaId) return badRequest('Either regionId or areaId is required')
    if (regionId && areaId) return badRequest('Provide either regionId or areaId, not both')
    if (clusterId && !areaId) return badRequest('clusterId requires areaId')

    const existing = await prisma.location.findUnique({ where: { code } })
    if (existing) return conflict('Shop code already exists')

    let parentId = regionId || areaId
    if (clusterId) parentId = clusterId

    if (parentId) {
      const parent = await prisma.location.findUnique({ where: { id: parentId } })
      if (!parent) return badRequest('Parent location not found')
      if (!['REGION', 'AREA', 'CLUSTER'].includes(parent.type)) return badRequest('Parent must be REGION, AREA, or CLUSTER')
    }

    if (shopManagerId) {
      const manager = await prisma.employee.findUnique({ where: { id: shopManagerId } })
      if (!manager) return badRequest('Shop manager not found')
      if (manager.employmentStatus !== 'ACTIVE') return badRequest('Shop manager must be an active employee')
      if (manager.currentRole !== 'SHOP_MANAGER') return badRequest('Employee must have role SHOP_MANAGER')
    }

    const location = await prisma.location.create({
      data: { name, code, type: 'SHOP', parentId, isActive: true },
    })

    await prisma.shopProfile.create({
      data: {
        shopLocationId: location.id,
        defaultShopManagerId: shopManagerId || null,
        corridorType: corridorType || 'UNKNOWN',
        isIncentiveEligible: isIncentiveEligible ?? false,
        createdById: session.userId,
      },
    })

    await prisma.shopCriteriaStatusHistory.create({
      data: {
        shopLocationId: location.id,
        criteria: 'UNASSIGNED',
        effectiveFrom: new Date(),
        updatedById: session.userId,
      },
    })

    if (shopManagerId) {
      await prisma.employee.update({ where: { id: shopManagerId }, data: { currentShopId: location.id } })
    }

    await createAuditLog({
      userId: session.userId, action: 'SHOP_CREATE', entityType: 'Location',
      entityId: location.id, newValue: { name, code, shopManagerId, corridorType },
    })

    const created = await prisma.location.findUnique({
      where: { id: location.id },
      include: {
        parent: { select: { id: true, name: true, code: true, type: true } },
        shopProfile: {
          include: {
            defaultShopManager: { select: { id: true, employeeId: true, fullName: true } },
          },
        },
      },
    })

    const currentCriteria = await prisma.shopCriteriaStatusHistory.findFirst({
      where: { shopLocationId: location.id, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    })

    return success({ ...created, currentCriteria: currentCriteria?.criteria ?? 'UNASSIGNED' }, 201)
  } catch (err) { console.error(err); return internalError() }
}
