import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/shop-scope'

const criteriaSchema = z.object({
  criteria: z.enum(['GOLD', 'SILVER', 'BRONZE', 'AT_RISK', 'UNASSIGNED']),
  effectiveFrom: z.string().min(1, 'effectiveFrom is required'),
  reason: z.string().min(1, 'reason is required'),
  approvedById: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.viewCriteriaHistory'))) return forbidden()
    if (!(await shopInUserScope(session.userId, id))) return forbidden()

    const shop = await prisma.location.findUnique({ where: { id } })
    if (!shop || shop.type !== 'SHOP') return notFound('Shop not found')

    const history = await prisma.shopCriteriaStatusHistory.findMany({
      where: { shopLocationId: id },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        updatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    })

    const current = history.find(h => !h.effectiveTo)

    return success({ history, currentCriteria: current?.criteria ?? 'UNASSIGNED' })
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shop.updateCriteria'))) return forbidden()
    if (!(await shopInUserScope(session.userId, id))) return forbidden()

    const shop = await prisma.location.findUnique({ where: { id } })
    if (!shop || shop.type !== 'SHOP') return notFound('Shop not found')

    const body = await req.json().catch(() => ({}))
    const parsed = criteriaSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { criteria, effectiveFrom, reason, approvedById } = parsed.data
    const effectiveDate = new Date(effectiveFrom)
    if (isNaN(effectiveDate.getTime())) return badRequest('Invalid effectiveFrom date')

    const currentActive = await prisma.shopCriteriaStatusHistory.findFirst({
      where: { shopLocationId: id, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    })

    if (currentActive) {
      const dayBefore = new Date(effectiveDate)
      dayBefore.setDate(dayBefore.getDate() - 1)
      await prisma.shopCriteriaStatusHistory.update({
        where: { id: currentActive.id },
        data: { effectiveTo: dayBefore < currentActive.effectiveFrom ? effectiveDate : dayBefore },
      })
    }

    const newStatus = await prisma.shopCriteriaStatusHistory.create({
      data: {
        shopLocationId: id,
        criteria,
        effectiveFrom: effectiveDate,
        reason,
        updatedById: session.userId,
        approvedById: approvedById || null,
      },
    })

    await createAuditLog({
      userId: session.userId, action: 'SHOP_CRITERIA_UPDATE', entityType: 'ShopCriteriaStatusHistory',
      entityId: newStatus.id,
      oldValue: currentActive ? { criteria: currentActive.criteria, effectiveFrom: currentActive.effectiveFrom } : null,
      newValue: { criteria, effectiveFrom, reason },
    })

    const created = await prisma.shopCriteriaStatusHistory.findUnique({
      where: { id: newStatus.id },
      include: {
        updatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    })

    return success(created, 201)
  } catch (err) { console.error(err); return internalError() }
}
