import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, userHasAnyPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { buildIncentiveScopeWhere, shopInUserScope } from '@/lib/incentive-scope'
import { validateShopCriteria } from '@/lib/shop-manager-incentives'

const createInputSchema = z.object({
  shopLocationId: z.string().min(1),
  shopManagerId: z.string().optional(),
  shopCriteria: z.string().optional(),
  corridorStatus: z.boolean().optional(),
  qgaAbove90: z.boolean().optional(),
  qgaQuantity: z.number().int().optional(),
  mmQoAbove90: z.boolean().optional(),
  dsaAirtimeAchievementPercent: z.number().optional(),
  evdAbove100AndReconciled: z.boolean().optional(),
  mpesaTargetAndReconciled: z.boolean().optional(),
  mpesaFloatSold: z.number().optional(),
  baSite: z.boolean().optional(),
  ebuTargetAchieved: z.boolean().optional(),
  ebuRevenueMade: z.boolean().optional(),
  ebuAverageTopupAbove500: z.boolean().optional(),
  ebuFirstMonthLfRevenue: z.number().optional(),
  responsibleRemarks: z.string().optional(),
})

const SALES_FIELDS = ['qgaAbove90', 'qgaQuantity', 'mmQoAbove90', 'dsaAirtimeAchievementPercent'] as const
const DISTRIBUTION_FIELDS = ['corridorStatus', 'evdAbove100AndReconciled', 'mpesaTargetAndReconciled', 'mpesaFloatSold', 'baSite'] as const
const EBU_FIELDS = ['ebuTargetAchieved', 'ebuRevenueMade', 'ebuAverageTopupAbove500', 'ebuFirstMonthLfRevenue'] as const
const ANY_INPUT_FIELDS = ['shopCriteria', 'shopManagerId', 'responsibleRemarks'] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const { searchParams } = new URL(req.url)
    const shopLocationId = searchParams.get('shopLocationId')

    const scopeWhere = await buildIncentiveScopeWhere(session.userId)

    const where: Record<string, unknown> = { incentivePeriodId: id, ...scopeWhere }
    if (shopLocationId) where.shopLocationId = shopLocationId

    const inputs = await prisma.shopManagerIncentiveInput.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        shopLocation: {
          select: { id: true, name: true, code: true },
        },
        shopManager: {
          select: { id: true, fullName: true, employeeId: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return success(inputs)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()

    const hasInputAll = await userHasPermission(session.userId, 'shopManagerIncentive.inputAll')
    const hasInputSales = await userHasPermission(session.userId, 'shopManagerIncentive.inputSales')
    const hasInputDistribution = await userHasPermission(session.userId, 'shopManagerIncentive.inputDistribution')
    const hasInputEbu = await userHasPermission(session.userId, 'shopManagerIncentive.inputEbu')

    if (!hasInputAll && !hasInputSales && !hasInputDistribution && !hasInputEbu) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const body = await req.json().catch(() => ({}))
    const parsed = createInputSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { shopLocationId, shopManagerId, shopCriteria, responsibleRemarks, ...fieldValues } = parsed.data

    if (!(await shopInUserScope(session.userId, shopLocationId))) return forbidden('Shop location not in your scope')

    const shopLocation = await prisma.location.findUnique({
      where: { id: shopLocationId },
    })
    if (!shopLocation) return notFound('Shop location not found')
    if (shopLocation.type !== 'SHOP') return badRequest('Location must be a SHOP type')

    let validatedCriteria: string | null = null
    if (shopCriteria) {
      validatedCriteria = validateShopCriteria(shopCriteria)
    }

    const existing = await prisma.shopManagerIncentiveInput.findUnique({
      where: { incentivePeriodId_shopLocationId: { incentivePeriodId: id, shopLocationId } },
    })
    if (existing) return conflict('Input already exists for this shop in this period')

    const isAtRisk = validatedCriteria === 'AT_RISK'

    function hasSalesPermission(field: string): boolean {
      return hasInputAll || (SALES_FIELDS as readonly string[]).includes(field)
    }
    function hasDistributionPermission(field: string): boolean {
      return hasInputAll || (DISTRIBUTION_FIELDS as readonly string[]).includes(field)
    }
    function hasEbuPermission(field: string): boolean {
      return hasInputAll || (EBU_FIELDS as readonly string[]).includes(field)
    }

    const dataToSet: Record<string, unknown> = {
      incentivePeriodId: id,
      shopLocationId,
      createdById: session.userId,
    }

    if (shopManagerId !== undefined) dataToSet.shopManagerId = shopManagerId
    if (validatedCriteria) dataToSet.shopCriteria = validatedCriteria
    if (responsibleRemarks !== undefined) dataToSet.responsibleRemarks = responsibleRemarks

    if (isAtRisk) {
      const providedFields = Object.keys(fieldValues).filter(k => (fieldValues as Record<string, unknown>)[k] !== undefined)
      if (providedFields.length > 0) {
        return badRequest('At-risk shops can only set shopCriteria and responsibleRemarks, not other field values')
      }
    } else {
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value === undefined) continue
        if ((SALES_FIELDS as readonly string[]).includes(key) && !hasSalesPermission(key)) {
          return forbidden(`You do not have permission to set ${key}`)
        }
        if ((DISTRIBUTION_FIELDS as readonly string[]).includes(key) && !hasDistributionPermission(key)) {
          return forbidden(`You do not have permission to set ${key}`)
        }
        if ((EBU_FIELDS as readonly string[]).includes(key) && !hasEbuPermission(key)) {
          return forbidden(`You do not have permission to set ${key}`)
        }
        dataToSet[key] = value
      }
    }

    const input = await prisma.shopManagerIncentiveInput.create({ data: dataToSet as any })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_CREATE',
      entityType: 'ShopManagerIncentiveInput',
      entityId: input.id,
      newValue: { incentivePeriodId: id, shopLocationId, ...dataToSet },
    })

    return success(input, 201)
  } catch (err) { console.error(err); return internalError() }
}
