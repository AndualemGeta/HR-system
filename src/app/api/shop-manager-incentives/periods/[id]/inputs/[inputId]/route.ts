import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/incentive-scope'
import { validateShopCriteria, validateIncentiveInputValues } from '@/lib/shop-manager-incentives'

const updateInputSchema = z.object({
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

const PERFORMANCE_FIELDS = [
  'qgaAbove90', 'qgaQuantity', 'mmQoAbove90', 'dsaAirtimeAchievementPercent',
  'corridorStatus', 'evdAbove100AndReconciled', 'mpesaTargetAndReconciled',
  'mpesaFloatSold', 'baSite', 'ebuTargetAchieved', 'ebuRevenueMade',
  'ebuAverageTopupAbove500', 'ebuFirstMonthLfRevenue',
] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const input = await prisma.shopManagerIncentiveInput.findUnique({
      where: { id: inputId },
      include: {
        incentivePeriod: { select: { id: true, name: true, month: true, year: true, status: true } },
        shopLocation: {
          select: { id: true, name: true, code: true },
        },
        shopManager: {
          select: { id: true, fullName: true, employeeId: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        calculation: true,
      },
    })

    if (!input) return notFound('Input not found')
    if (input.incentivePeriodId !== id) return notFound('Input not found in this period')

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    return success(input)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()

    const hasInputAll = await userHasPermission(session.userId, 'shopManagerIncentive.inputAll')
    const hasInputSales = await userHasPermission(session.userId, 'shopManagerIncentive.inputSales')
    const hasInputDistribution = await userHasPermission(session.userId, 'shopManagerIncentive.inputDistribution')
    const hasInputEbu = await userHasPermission(session.userId, 'shopManagerIncentive.inputEbu')
    if (!hasInputAll && !hasInputSales && !hasInputDistribution && !hasInputEbu) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status === 'CANCELLED') return badRequest('Cannot update inputs for a cancelled period')

    const input = await prisma.shopManagerIncentiveInput.findUnique({
      where: { id: inputId },
    })
    if (!input) return notFound('Input not found')
    if (input.incentivePeriodId !== id) return notFound('Input not found in this period')

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = updateInputSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const fieldValues = parsed.data

    if (fieldValues.shopManagerId !== undefined) {
      const manager = await prisma.employee.findUnique({ where: { id: fieldValues.shopManagerId } })
      if (!manager) return badRequest('Shop manager not found')
      if (manager.employmentStatus !== 'ACTIVE') return badRequest('Shop manager must be an active employee')
      if (manager.currentRole !== 'SHOP_MANAGER') return badRequest('Employee must have role SHOP_MANAGER')
    }

    const validation = validateIncentiveInputValues(fieldValues as Record<string, unknown>)
    if (!validation.valid) return badRequest('Validation failed', validation.errors)

    const isCurrentlyAtRisk = input.shopCriteria === 'AT_RISK'

    let validatedCriteria: string | null = null
    if (fieldValues.shopCriteria !== undefined) {
      try {
        validatedCriteria = validateShopCriteria(fieldValues.shopCriteria)
      } catch (e) {
        return badRequest((e as Error).message)
      }
    }

    const isChangingToAtRisk = validatedCriteria === 'AT_RISK'

    const hasSalesPermission = (): boolean => hasInputAll || hasInputSales
    const hasDistributionPermission = (): boolean => hasInputAll || hasInputDistribution
    const hasEbuPermission = (): boolean => hasInputAll || hasInputEbu

    const updateData: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    if (isCurrentlyAtRisk) {
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value === undefined) continue
        if (!(ANY_INPUT_FIELDS as readonly string[]).includes(key as any)) {
          return badRequest('At-risk inputs can only update shopCriteria, shopManagerId, and responsibleRemarks')
        }
        updateData[key] = value
        oldValues[key] = (input as Record<string, unknown>)[key]
        newValues[key] = value
      }
    } else {
      if (period.status === 'DRAFT') {
        const providedFields = Object.keys(fieldValues).filter(k => fieldValues[k as keyof typeof fieldValues] !== undefined)
        const perfFieldsInDraft = providedFields.filter(k => (PERFORMANCE_FIELDS as readonly string[]).includes(k as any))
        if (perfFieldsInDraft.length > 0) {
          return badRequest('Draft periods only allow updating shopCriteria, shopManagerId, and responsibleRemarks')
        }
      }

      for (const [key, value] of Object.entries(fieldValues)) {
        if (value === undefined) continue

        if ((SALES_FIELDS as readonly string[]).includes(key as any) && !hasSalesPermission()) {
          return forbidden(`You do not have permission to update ${key}`)
        }
        if ((DISTRIBUTION_FIELDS as readonly string[]).includes(key as any) && !hasDistributionPermission()) {
          return forbidden(`You do not have permission to update ${key}`)
        }
        if ((EBU_FIELDS as readonly string[]).includes(key as any) && !hasEbuPermission()) {
          return forbidden(`You do not have permission to update ${key}`)
        }

        updateData[key] = value
        oldValues[key] = (input as Record<string, unknown>)[key]
        newValues[key] = value
      }
    }

    if (validatedCriteria !== null) {
      updateData.shopCriteria = validatedCriteria
      newValues.shopCriteria = validatedCriteria
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest('No fields to update')
    }

    let updated: any
    let statusReverted = false

    if (isChangingToAtRisk && !isCurrentlyAtRisk) {
      updated = await prisma.$transaction(async (tx) => {
        const cleared: Record<string, unknown> = {}
        for (const f of PERFORMANCE_FIELDS) {
          cleared[f as string] = null
        }

        const result = await tx.shopManagerIncentiveInput.update({
          where: { id: inputId },
          data: {
            ...updateData,
            ...cleared,
            updatedById: session.userId,
          } as any,
        })

        await tx.shopManagerIncentiveCalculation.deleteMany({
          where: { inputId },
        })

        return result
      })

      for (const f of PERFORMANCE_FIELDS as readonly string[]) {
        if (!(f in oldValues)) {
          oldValues[f] = (input as Record<string, unknown>)[f]
          newValues[f] = null
        }
      }

      if (period.status === 'CALCULATED') {
        await prisma.shopManagerIncentivePeriod.update({
          where: { id },
          data: { status: 'OPEN' },
        })
        statusReverted = true
      }
    } else {
      updateData.updatedById = session.userId

      updated = await prisma.shopManagerIncentiveInput.update({
        where: { id: inputId },
        data: updateData as any,
      })

      if (period.status === 'CALCULATED') {
        await prisma.shopManagerIncentivePeriod.update({
          where: { id },
          data: { status: 'OPEN' },
        })
        await prisma.shopManagerIncentiveCalculation.deleteMany({
          where: { incentivePeriodId: id },
        })
        statusReverted = true
      }
    }

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_UPDATE',
      entityType: 'ShopManagerIncentiveInput',
      entityId: inputId,
      oldValue: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValue: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    if (statusReverted) {
      await createAuditLog({
        userId: session.userId,
        action: 'SHOP_MANAGER_INCENTIVE_RECALCULATION_REQUIRED',
        entityType: 'ShopManagerIncentivePeriod',
        entityId: id,
        oldValue: { status: 'CALCULATED' },
        newValue: { status: 'OPEN' },
      })
    }

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()

    const hasInputAll = await userHasPermission(session.userId, 'shopManagerIncentive.inputAll')
    const hasInputSales = await userHasPermission(session.userId, 'shopManagerIncentive.inputSales')
    const hasInputDistribution = await userHasPermission(session.userId, 'shopManagerIncentive.inputDistribution')
    const hasInputEbu = await userHasPermission(session.userId, 'shopManagerIncentive.inputEbu')
    if (!hasInputAll && !hasInputSales && !hasInputDistribution && !hasInputEbu) return forbidden()

    const period = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id } })
    if (!period) return notFound('Incentive period not found')
    if (period.status === 'CANCELLED') return badRequest('Cannot delete inputs for a cancelled period')

    const input = await prisma.shopManagerIncentiveInput.findUnique({
      where: { id: inputId },
    })
    if (!input) return notFound('Input not found')
    if (input.incentivePeriodId !== id) return notFound('Input not found in this period')

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    if (period.status !== 'DRAFT' && period.status !== 'OPEN' && period.status !== 'CALCULATED') {
      return badRequest('Can only delete inputs in DRAFT, OPEN, or CALCULATED periods')
    }

    if (period.status === 'CALCULATED') {
      await prisma.$transaction(async (tx) => {
        await tx.shopManagerIncentiveInput.delete({ where: { id: inputId } })
        await tx.shopManagerIncentivePeriod.update({
          where: { id },
          data: { status: 'OPEN' },
        })
        await tx.shopManagerIncentiveCalculation.deleteMany({
          where: { incentivePeriodId: id },
        })
      })

      await createAuditLog({
        userId: session.userId,
        action: 'SHOP_MANAGER_INCENTIVE_RECALCULATION_REQUIRED',
        entityType: 'ShopManagerIncentivePeriod',
        entityId: id,
        oldValue: { status: 'CALCULATED' },
        newValue: { status: 'OPEN' },
      })
    } else {
      await prisma.shopManagerIncentiveInput.delete({ where: { id: inputId } })
    }

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_DELETE',
      entityType: 'ShopManagerIncentiveInput',
      entityId: inputId,
      oldValue: { incentivePeriodId: id, shopLocationId: input.shopLocationId },
    })

    return success({ deleted: true })
  } catch (err) { console.error(err); return internalError() }
}
