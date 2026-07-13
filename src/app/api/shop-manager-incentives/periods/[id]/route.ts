import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        payrollPeriod: { select: { id: true, periodName: true, periodStart: true, periodEnd: true, status: true } },
        _count: {
          select: {
            inputs: true,
            calculations: true,
          },
        },
      },
    })
    if (!period) return notFound('Incentive period not found')

    const shopCount = await prisma.shopManagerIncentiveInput.groupBy({
      by: ['shopLocationId'],
      where: { incentivePeriodId: id },
      _count: true,
    })

    return success({ ...period, shopCount: shopCount.length })
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.updatePeriod'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status !== 'DRAFT') return badRequest('Only periods in DRAFT status can be edited')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { name, month, year } = parsed.data
    const updateData: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    if (name !== undefined) {
      updateData.name = name
      oldValues.name = period.name
      newValues.name = name
    }
    if (month !== undefined) {
      updateData.month = month
      oldValues.month = period.month
      newValues.month = month
    }
    if (year !== undefined) {
      updateData.year = year
      oldValues.year = period.year
      newValues.year = year
    }

    if (Object.keys(updateData).length === 0) return badRequest('No fields to update')

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_PERIOD_UPDATE',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      oldValue: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValue: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
