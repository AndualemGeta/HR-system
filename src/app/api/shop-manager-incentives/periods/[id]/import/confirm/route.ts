import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { getShopCriteriaForPeriod, getShopProfileForIncentive } from '@/lib/shop-manager-incentives'

const confirmRowSchema = z.object({
  shopCode: z.string().min(1),
  shopLocationId: z.string().min(1),
  shopManagerEmployeeId: z.string().optional().default(''),
  qgaAchievementPercent: z.number().nullable().optional(),
  qgaCount: z.number().nullable().optional(),
  evdAchievementPercent: z.number().nullable().optional(),
  evdReconciled: z.boolean().nullable().optional(),
  baSiteRequirementMet: z.boolean().nullable().optional(),
  mpesaFloatSold: z.number().nullable().optional(),
  mpesaTargetAchieved: z.boolean().nullable().optional(),
  mpesaReconciled: z.boolean().nullable().optional(),
  dsaAirtimeAchievementPercent: z.number().nullable().optional(),
  mmQoTargetPercent: z.number().nullable().optional(),
  ebuTargetAchieved: z.boolean().nullable().optional(),
  ebuRevenue: z.number().nullable().optional(),
  ebuAverageTopup: z.number().nullable().optional(),
  ebuFirstMonthLeapfrogRevenue: z.number().nullable().optional(),
  notes: z.string().optional().default(''),
})

const confirmSchema = z.object({
  rows: z.array(confirmRowSchema),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.import'))) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')

    const body = await req.json().catch(() => ({}))
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { rows } = parsed.data
    if (rows.length === 0) return badRequest('No rows to import')

    let created = 0
    let updated = 0
    let skipped = 0
    const details: Array<{ shopCode: string; action: string; inputId?: string }> = []

    for (const row of rows) {
      const shopLocation = await prisma.location.findUnique({
        where: { id: row.shopLocationId },
        include: { shopProfile: true },
      })
      if (!shopLocation || !shopLocation.shopProfile) {
        details.push({ shopCode: row.shopCode, action: 'SKIPPED_NO_SHOP' })
        skipped++
        continue
      }

      const performanceData: Record<string, unknown> = {}
      if (row.qgaAchievementPercent !== undefined) performanceData.qgaAchievementPercent = row.qgaAchievementPercent
      if (row.qgaCount !== undefined) performanceData.qgaCount = row.qgaCount
      if (row.evdAchievementPercent !== undefined) performanceData.evdAchievementPercent = row.evdAchievementPercent
      if (row.evdReconciled !== undefined) performanceData.evdReconciled = row.evdReconciled
      if (row.baSiteRequirementMet !== undefined) performanceData.baSiteRequirementMet = row.baSiteRequirementMet
      if (row.mpesaFloatSold !== undefined) performanceData.mpesaFloatSold = row.mpesaFloatSold
      if (row.mpesaTargetAchieved !== undefined) performanceData.mpesaTargetAchieved = row.mpesaTargetAchieved
      if (row.mpesaReconciled !== undefined) performanceData.mpesaReconciled = row.mpesaReconciled
      if (row.dsaAirtimeAchievementPercent !== undefined) performanceData.dsaAirtimeAchievementPercent = row.dsaAirtimeAchievementPercent
      if (row.mmQoTargetPercent !== undefined) performanceData.mmQoTargetPercent = row.mmQoTargetPercent
      if (row.ebuTargetAchieved !== undefined) performanceData.ebuTargetAchieved = row.ebuTargetAchieved
      if (row.ebuRevenue !== undefined) performanceData.ebuRevenue = row.ebuRevenue
      if (row.ebuAverageTopup !== undefined) performanceData.ebuAverageTopup = row.ebuAverageTopup
      if (row.ebuFirstMonthLeapfrogRevenue !== undefined) performanceData.ebuFirstMonthLeapfrogRevenue = row.ebuFirstMonthLeapfrogRevenue

      const shopProfile = shopLocation.shopProfile
      const shopManagerId = shopProfile.defaultShopManagerId
      const periodDate = new Date(period.year, period.month - 1)
      const { criteria: shopCriteria } = await getShopCriteriaForPeriod(row.shopLocationId, periodDate)

      const existing = await prisma.shopManagerPerformanceInput.findUnique({
        where: { incentivePeriodId_shopLocationId: { incentivePeriodId: id, shopLocationId: row.shopLocationId } },
      })

      if (existing) {
        if (existing.inputStatus === 'LOCKED') {
          details.push({ shopCode: row.shopCode, action: 'SKIPPED_LOCKED', inputId: existing.id })
          skipped++
          continue
        }

        const updatedInput = await prisma.shopManagerPerformanceInput.update({
          where: { id: existing.id },
          data: {
            ...performanceData,
            shopCriteria: shopCriteria as any || existing.shopCriteria,
            corridorType: shopProfile.corridorType,
            shopManagerId: shopManagerId || existing.shopManagerId,
            notes: row.notes !== '' ? row.notes : existing.notes,
            updatedById: session.userId,
          },
        })

        await createAuditLog({
          userId: session.userId,
          action: 'SHOP_MANAGER_INCENTIVE_INPUT_UPDATE',
          entityType: 'ShopManagerPerformanceInput',
          entityId: updatedInput.id,
          newValue: { ...performanceData, shopCode: row.shopCode },
        })

        details.push({ shopCode: row.shopCode, action: 'UPDATED', inputId: updatedInput.id })
        updated++
      } else {
        const newInput = await prisma.shopManagerPerformanceInput.create({
          data: {
            incentivePeriodId: id,
            shopLocationId: row.shopLocationId,
            shopManagerId: shopManagerId,
            shopCriteria: shopCriteria as any || undefined,
            corridorType: shopProfile.corridorType,
            ...performanceData,
            notes: row.notes || null,
            inputStatus: 'DRAFT',
            createdById: session.userId,
          },
        })

        await createAuditLog({
          userId: session.userId,
          action: 'SHOP_MANAGER_INCENTIVE_INPUT_CREATE',
          entityType: 'ShopManagerPerformanceInput',
          entityId: newInput.id,
          newValue: { ...performanceData, shopCode: row.shopCode },
        })

        details.push({ shopCode: row.shopCode, action: 'CREATED', inputId: newInput.id })
        created++
      }
    }

    return success({
      periodId: id,
      created,
      updated,
      skipped,
      total: created + updated + skipped,
      details,
    })
  } catch (err) { console.error(err); return internalError() }
}
