import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { buildIncentiveInputScopeWhere, shopInUserScope } from '@/lib/incentive-scope'
import { getShopCriteriaForPeriod, getShopProfileForIncentive, validatePerformanceInput } from '@/lib/shop-manager-incentives'

const createInputSchema = z.object({
  shopLocationId: z.string().min(1),
  qgaAchievementPercent: z.number().optional(),
  qgaCount: z.number().int().optional(),
  evdAchievementPercent: z.number().optional(),
  evdReconciled: z.boolean().optional(),
  baSiteRequirementMet: z.boolean().optional(),
  mpesaFloatSold: z.number().optional(),
  mpesaTargetAchieved: z.boolean().optional(),
  mpesaReconciled: z.boolean().optional(),
  dsaAirtimeAchievementPercent: z.number().optional(),
  mmQoTargetPercent: z.number().optional(),
  ebuTargetAchieved: z.boolean().optional(),
  ebuRevenue: z.number().optional(),
  ebuAverageTopup: z.number().optional(),
  ebuFirstMonthLeapfrogRevenue: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const { searchParams } = new URL(req.url)
    const inputStatus = searchParams.get('inputStatus')
    const shopLocationId = searchParams.get('shopLocationId')

    const scopeWhere = await buildIncentiveInputScopeWhere(session.userId)

    const where: Record<string, unknown> = { incentivePeriodId: id, ...scopeWhere }
    if (inputStatus) where.inputStatus = inputStatus
    if (shopLocationId) where.shopLocationId = shopLocationId

    const inputs = await prisma.shopManagerPerformanceInput.findMany({
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
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
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
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.input'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const body = await req.json().catch(() => ({}))
    const parsed = createInputSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { shopLocationId, notes, ...performanceData } = parsed.data

    if (!(await shopInUserScope(session.userId, shopLocationId))) return forbidden('Shop location not in your scope')

    const shopLocation = await prisma.location.findUnique({
      where: { id: shopLocationId },
    })
    if (!shopLocation) return notFound('Shop location not found')
    if (shopLocation.type !== 'SHOP') return badRequest('Location must be a SHOP type')

    const shopProfile = await prisma.shopProfile.findUnique({
      where: { shopLocationId },
      select: { id: true, corridorType: true, defaultShopManagerId: true, isIncentiveEligible: true },
    })
    if (!shopProfile) return badRequest('Shop profile not found for this location')
    if (!shopProfile.isIncentiveEligible) return badRequest('Shop is not eligible for incentives')

    const existing = await prisma.shopManagerPerformanceInput.findUnique({
      where: { incentivePeriodId_shopLocationId: { incentivePeriodId: id, shopLocationId } },
    })
    if (existing) return conflict('Performance input already exists for this shop in this period')

    const periodDate = new Date(period.year, period.month - 1)
    const { criteria: shopCriteria } = await getShopCriteriaForPeriod(shopLocationId, periodDate)

    const validationInput = {
      shopManagerId: shopProfile.defaultShopManagerId,
      shopCriteria: shopCriteria || 'UNASSIGNED',
      corridorType: shopProfile.corridorType,
      qgaAchievementPercent: performanceData.qgaAchievementPercent ?? null,
      qgaCount: performanceData.qgaCount ?? null,
      evdAchievementPercent: performanceData.evdAchievementPercent ?? null,
      evdReconciled: performanceData.evdReconciled ?? null,
      baSiteRequirementMet: performanceData.baSiteRequirementMet ?? null,
      mpesaFloatSold: performanceData.mpesaFloatSold ?? null,
      mpesaTargetAchieved: performanceData.mpesaTargetAchieved ?? null,
      mpesaReconciled: performanceData.mpesaReconciled ?? null,
      dsaAirtimeAchievementPercent: performanceData.dsaAirtimeAchievementPercent ?? null,
      mmQoTargetPercent: performanceData.mmQoTargetPercent ?? null,
      ebuTargetAchieved: performanceData.ebuTargetAchieved ?? null,
      ebuRevenue: performanceData.ebuRevenue ?? null,
      ebuAverageTopup: performanceData.ebuAverageTopup ?? null,
      ebuFirstMonthLeapfrogRevenue: performanceData.ebuFirstMonthLeapfrogRevenue ?? null,
    }

    const validation = await validatePerformanceInput(validationInput)
    if (!validation.valid) {
      return badRequest('Validation failed', validation.issues)
    }

    const input = await prisma.shopManagerPerformanceInput.create({
      data: {
        incentivePeriodId: id,
        shopLocationId,
        shopManagerId: shopProfile.defaultShopManagerId,
        shopCriteria: shopCriteria as any || undefined,
        corridorType: shopProfile.corridorType,
        ...performanceData,
        notes,
        inputStatus: 'DRAFT',
        createdById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_CREATE',
      entityType: 'ShopManagerPerformanceInput',
      entityId: input.id,
      newValue: { incentivePeriodId: id, shopLocationId, shopManagerId: shopProfile.defaultShopManagerId, ...performanceData, notes },
    })

    return success(input, 201)
  } catch (err) { console.error(err); return internalError() }
}
