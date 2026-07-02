import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/shop-scope'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  regionId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  clusterId: z.string().nullable().optional(),
  shopManagerId: z.string().nullable().optional(),
  corridorType: z.enum(['CORRIDOR', 'NON_CORRIDOR', 'UNKNOWN']).optional(),
  isIncentiveEligible: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.view'))) return forbidden()
    if (!(await shopInUserScope(session.userId, id))) return forbidden()

    const shop = await prisma.location.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, code: true, type: true, parentId: true,
            parent: { select: { id: true, name: true, code: true, type: true } } },
        },
        shopProfile: {
          include: {
            defaultShopManager: { select: { id: true, employeeId: true, fullName: true, currentRole: true, employmentStatus: true } },
          },
        },
      },
    })
    if (!shop || shop.type !== 'SHOP') return notFound('Shop not found')

    const currentCriteria = await prisma.shopCriteriaStatusHistory.findFirst({
      where: { shopLocationId: id, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    })

    const criteriaHistory = await prisma.shopCriteriaStatusHistory.findMany({
      where: { shopLocationId: id },
      orderBy: { effectiveFrom: 'desc' },
      take: 20,
    })

    const assignedEmployees = await prisma.employee.findMany({
      where: { currentShopId: id, employmentStatus: { not: 'EXITED' } },
      select: { id: true, employeeId: true, fullName: true, currentRole: true, employmentStatus: true },
      orderBy: { fullName: 'asc' },
    })

    return success({
      ...shop,
      currentCriteria: currentCriteria?.criteria ?? 'UNASSIGNED',
      criteriaHistory,
      assignedEmployees,
    })
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.update'))) return forbidden()
    if (!(await shopInUserScope(session.userId, id))) return forbidden()

    const shop = await prisma.location.findUnique({
      where: { id },
      include: { shopProfile: true },
    })
    if (!shop || shop.type !== 'SHOP') return notFound('Shop not found')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { name, regionId, areaId, clusterId, shopManagerId, corridorType, isIncentiveEligible, isActive } = parsed.data

    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}
    const updateData: Record<string, unknown> = {}
    let parentId: string | null | undefined

    if (regionId !== undefined) {
      parentId = regionId
    } else if (areaId !== undefined) {
      parentId = areaId
    } else if (clusterId !== undefined) {
      parentId = clusterId
    }

    if (parentId !== undefined) {
      if (parentId) {
        const parent = await prisma.location.findUnique({ where: { id: parentId } })
        if (!parent) return badRequest('Parent location not found')
        if (!['REGION', 'AREA', 'CLUSTER'].includes(parent.type)) return badRequest('Parent must be REGION, AREA, or CLUSTER')
      }
      oldValues.parentId = shop.parentId
      newValues.parentId = parentId
      updateData.parentId = parentId
    }

    if (name !== undefined) {
      oldValues.name = shop.name
      newValues.name = name
      updateData.name = name
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.location.update({ where: { id }, data: updateData })
    }

    if (shop.shopProfile) {
      const profileUpdate: Record<string, unknown> = {}
      if (corridorType !== undefined) {
        oldValues.corridorType = shop.shopProfile.corridorType
        newValues.corridorType = corridorType
        profileUpdate.corridorType = corridorType
      }
      if (isIncentiveEligible !== undefined) {
        oldValues.isIncentiveEligible = shop.shopProfile.isIncentiveEligible
        newValues.isIncentiveEligible = isIncentiveEligible
        profileUpdate.isIncentiveEligible = isIncentiveEligible
      }
      if (Object.keys(profileUpdate).length > 0) {
        profileUpdate.updatedById = session.userId
        await prisma.shopProfile.update({ where: { shopLocationId: id }, data: profileUpdate })
      }
    }

    if (shopManagerId !== undefined) {
      const oldManagerId = shop.shopProfile?.defaultShopManagerId
      oldValues.shopManagerId = oldManagerId
      newValues.shopManagerId = shopManagerId

      if (shopManagerId) {
        const manager = await prisma.employee.findUnique({ where: { id: shopManagerId } })
        if (!manager) return badRequest('Shop manager not found')
        if (manager.employmentStatus !== 'ACTIVE') return badRequest('Shop manager must be an active employee')
        if (manager.currentRole !== 'SHOP_MANAGER') return badRequest('Employee must have role SHOP_MANAGER')
      }

      await prisma.shopProfile.update({
        where: { shopLocationId: id },
        data: { defaultShopManagerId: shopManagerId, updatedById: session.userId },
      })

      if (shopManagerId) {
        await prisma.employee.update({ where: { id: shopManagerId }, data: { currentShopId: id } })
      }

      if (oldManagerId && oldManagerId !== shopManagerId) {
        await prisma.employee.update({ where: { id: oldManagerId }, data: { currentShopId: null } }).catch(() => {})
      }

      await createAuditLog({
        userId: session.userId, action: 'SHOP_MANAGER_ASSIGN', entityType: 'ShopProfile',
        entityId: shop.shopProfile?.id, oldValue: { defaultShopManagerId: oldManagerId },
        newValue: { defaultShopManagerId: shopManagerId },
      })
    }

    if (Object.keys(newValues).length > 0 && shopManagerId === undefined) {
      const action = corridorType !== undefined || isIncentiveEligible !== undefined ? 'SHOP_PROFILE_UPDATE' : 'SHOP_UPDATE'
      await createAuditLog({
        userId: session.userId, action: action as 'SHOP_UPDATE' | 'SHOP_PROFILE_UPDATE',
        entityType: 'Location', entityId: id, oldValue: oldValues, newValue: newValues,
      })
    }

    const updated = await prisma.location.findUnique({
      where: { id },
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
      where: { shopLocationId: id, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    })

    return success({ ...updated, currentCriteria: currentCriteria?.criteria ?? 'UNASSIGNED' })
  } catch (err) { console.error(err); return internalError() }
}
