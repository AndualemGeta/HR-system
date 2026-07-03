import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

function parseBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toLowerCase()
  if (['true', 'yes', '1'].includes(s)) return true
  if (['false', 'no', '0'].includes(s)) return false
  return null
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  const n = Number(String(val).trim())
  return isNaN(n) ? null : n
}

function parsePercent(val: unknown): number | null {
  const n = parseNumber(val)
  if (n === null) return null
  if (n < 0 || n > 200) return null
  return n
}

const importRowSchema = z.object({
  shopCode: z.string().min(1),
  shopName: z.string().optional().default(''),
  shopManagerEmployeeId: z.string().optional().default(''),
  qgaAchievementPercent: z.unknown().optional(),
  qgaCount: z.unknown().optional(),
  evdAchievementPercent: z.unknown().optional(),
  evdReconciled: z.unknown().optional(),
  baSiteRequirementMet: z.unknown().optional(),
  mpesaFloatSold: z.unknown().optional(),
  mpesaTargetAchieved: z.unknown().optional(),
  mpesaReconciled: z.unknown().optional(),
  dsaAirtimeAchievementPercent: z.unknown().optional(),
  mmQoTargetPercent: z.unknown().optional(),
  ebuTargetAchieved: z.unknown().optional(),
  ebuRevenue: z.unknown().optional(),
  ebuAverageTopup: z.unknown().optional(),
  ebuFirstMonthLeapfrogRevenue: z.unknown().optional(),
  notes: z.string().optional().default(''),
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
    const { rows } = body as { rows?: unknown[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return badRequest('Request must include a non-empty rows array')
    }

    const resultRows: Array<{
      rowIndex: number
      shopCode: string
      shopName: string
      isValid: boolean
      errors: string[]
      warnings: string[]
      data: Record<string, unknown> | null
    }> = []

    const seenShopCodes = new Map<string, number[]>()

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      const parsed = importRowSchema.safeParse(raw)
      if (!parsed.success) {
        resultRows.push({
          rowIndex: i,
          shopCode: (raw as any)?.shopCode || '',
          shopName: (raw as any)?.shopName || '',
          isValid: false,
          errors: ['Invalid row structure: ' + JSON.stringify(parsed.error.flatten())],
          warnings: [],
          data: null,
        })
        continue
      }

      const row = parsed.data
      const errors: string[] = []
      const warnings: string[] = []

      if (seenShopCodes.has(row.shopCode)) {
        warnings.push(`Duplicate shop code "${row.shopCode}" found in rows: ${seenShopCodes.get(row.shopCode)!.join(', ')} and ${i}`)
      }
      const existingIndices = seenShopCodes.get(row.shopCode) || []
      existingIndices.push(i)
      seenShopCodes.set(row.shopCode, existingIndices)

      const shopLocation = await prisma.location.findFirst({
        where: { code: row.shopCode, type: 'SHOP', isActive: true },
        include: { shopProfile: true },
      })

      if (!shopLocation) {
        errors.push(`Shop code "${row.shopCode}" not found or is not an active SHOP`)
      } else if (!shopLocation.shopProfile) {
        errors.push(`Shop "${row.shopCode}" has no ShopProfile`)
      }

      const qgaAchievementPercent = parsePercent(row.qgaAchievementPercent)
      if (row.qgaAchievementPercent !== undefined && row.qgaAchievementPercent !== '' && qgaAchievementPercent === null) {
        errors.push('qgaAchievementPercent must be a number between 0 and 200')
      }

      const qgaCount = parseNumber(row.qgaCount)
      if (row.qgaCount !== undefined && row.qgaCount !== '' && (qgaCount === null || qgaCount < 0)) {
        errors.push('qgaCount must be a non-negative number')
      }

      const evdAchievementPercent = parsePercent(row.evdAchievementPercent)
      if (row.evdAchievementPercent !== undefined && row.evdAchievementPercent !== '' && evdAchievementPercent === null) {
        errors.push('evdAchievementPercent must be a number between 0 and 200')
      }

      const evdReconciled = parseBoolean(row.evdReconciled)
      if (row.evdReconciled !== undefined && row.evdReconciled !== '' && evdReconciled === null) {
        errors.push('evdReconciled must be yes/no, true/false, or 1/0')
      }

      const baSiteRequirementMet = parseBoolean(row.baSiteRequirementMet)
      if (row.baSiteRequirementMet !== undefined && row.baSiteRequirementMet !== '' && baSiteRequirementMet === null) {
        errors.push('baSiteRequirementMet must be yes/no, true/false, or 1/0')
      }

      const mpesaFloatSold = parseNumber(row.mpesaFloatSold)
      if (row.mpesaFloatSold !== undefined && row.mpesaFloatSold !== '' && (mpesaFloatSold === null || mpesaFloatSold < 0)) {
        errors.push('mpesaFloatSold must be a non-negative number')
      }

      const mpesaTargetAchieved = parseBoolean(row.mpesaTargetAchieved)
      if (row.mpesaTargetAchieved !== undefined && row.mpesaTargetAchieved !== '' && mpesaTargetAchieved === null) {
        errors.push('mpesaTargetAchieved must be yes/no, true/false, or 1/0')
      }

      const mpesaReconciled = parseBoolean(row.mpesaReconciled)
      if (row.mpesaReconciled !== undefined && row.mpesaReconciled !== '' && mpesaReconciled === null) {
        errors.push('mpesaReconciled must be yes/no, true/false, or 1/0')
      }

      const dsaAirtimeAchievementPercent = parsePercent(row.dsaAirtimeAchievementPercent)
      if (row.dsaAirtimeAchievementPercent !== undefined && row.dsaAirtimeAchievementPercent !== '' && dsaAirtimeAchievementPercent === null) {
        errors.push('dsaAirtimeAchievementPercent must be a number between 0 and 200')
      }

      const mmQoTargetPercent = parsePercent(row.mmQoTargetPercent)
      if (row.mmQoTargetPercent !== undefined && row.mmQoTargetPercent !== '' && mmQoTargetPercent === null) {
        errors.push('mmQoTargetPercent must be a number between 0 and 200')
      }

      const ebuTargetAchieved = parseBoolean(row.ebuTargetAchieved)
      if (row.ebuTargetAchieved !== undefined && row.ebuTargetAchieved !== '' && ebuTargetAchieved === null) {
        errors.push('ebuTargetAchieved must be yes/no, true/false, or 1/0')
      }

      const ebuRevenue = parseNumber(row.ebuRevenue)
      if (row.ebuRevenue !== undefined && row.ebuRevenue !== '' && (ebuRevenue === null || ebuRevenue < 0)) {
        errors.push('ebuRevenue must be a non-negative number')
      }

      const ebuAverageTopup = parseNumber(row.ebuAverageTopup)
      if (row.ebuAverageTopup !== undefined && row.ebuAverageTopup !== '' && (ebuAverageTopup === null || ebuAverageTopup < 0)) {
        errors.push('ebuAverageTopup must be a non-negative number')
      }

      const ebuFirstMonthLeapfrogRevenue = parseNumber(row.ebuFirstMonthLeapfrogRevenue)
      if (row.ebuFirstMonthLeapfrogRevenue !== undefined && row.ebuFirstMonthLeapfrogRevenue !== '' && (ebuFirstMonthLeapfrogRevenue === null || ebuFirstMonthLeapfrogRevenue < 0)) {
        errors.push('ebuFirstMonthLeapfrogRevenue must be a non-negative number')
      }

      if (seenShopCodes.get(row.shopCode)!.length > 1) {
        warnings.push(`Duplicate shop code "${row.shopCode}" found`)
      }

      const data: Record<string, unknown> = {
        shopCode: row.shopCode,
        shopName: row.shopName,
        shopLocationId: shopLocation?.id || null,
        shopManagerEmployeeId: row.shopManagerEmployeeId,
        qgaAchievementPercent,
        qgaCount,
        evdAchievementPercent,
        evdReconciled,
        baSiteRequirementMet,
        mpesaFloatSold,
        mpesaTargetAchieved,
        mpesaReconciled,
        dsaAirtimeAchievementPercent,
        mmQoTargetPercent,
        ebuTargetAchieved,
        ebuRevenue,
        ebuAverageTopup,
        ebuFirstMonthLeapfrogRevenue,
        notes: row.notes,
      }

      resultRows.push({
        rowIndex: i,
        shopCode: row.shopCode,
        shopName: row.shopName,
        isValid: errors.length === 0,
        errors,
        warnings,
        data: errors.length === 0 ? data : null,
      })
    }

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_CALCULATE',
      entityType: 'ShopManagerIncentivePeriod',
      entityId: id,
      newValue: {
        importPreview: true,
        totalRows: rows.length,
        validRows: resultRows.filter(r => r.isValid).length,
        invalidRows: resultRows.filter(r => !r.isValid).length,
      },
    })

    return success({
      periodId: id,
      totalRows: rows.length,
      validCount: resultRows.filter(r => r.isValid).length,
      invalidCount: resultRows.filter(r => !r.isValid).length,
      rows: resultRows,
    })
  } catch (err) { console.error(err); return internalError() }
}
