import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/incentive-scope'

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

    const input = await prisma.shopManagerIncentiveInput.findUnique({
      where: { id: inputId },
    })
    if (!input) return notFound('Input not found')
    if (input.incentivePeriodId !== id) return notFound('Input not found in this period')

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = updateInputSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { ...fieldValues } = parsed.data

    const isAtRisk = input.shopCriteria === 'AT_RISK'
    const updateData: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(fieldValues)) {
      if (value === undefined) continue

      if (isAtRisk && !(ANY_INPUT_FIELDS as readonly string[]).includes(key as any)) {
        return badRequest(`At-risk inputs can only update shopCriteria, shopManagerId, and responsibleRemarks`)
      }

      if ((SALES_FIELDS as readonly string[]).includes(key as any) && !hasInputAll && !hasInputSales) {
        return forbidden(`You do not have permission to update ${key}`)
      }
      if ((DISTRIBUTION_FIELDS as readonly string[]).includes(key as any) && !hasInputAll && !hasInputDistribution) {
        return forbidden(`You do not have permission to update ${key}`)
      }
      if ((EBU_FIELDS as readonly string[]).includes(key as any) && !hasInputAll && !hasInputEbu) {
        return forbidden(`You do not have permission to update ${key}`)
      }

      updateData[key] = value
      oldValues[key] = (input as Record<string, unknown>)[key]
      newValues[key] = value
    }

    if (Object.keys(updateData).length === 0) return badRequest('No fields to update')

    updateData.updatedById = session.userId

    const updated = await prisma.shopManagerIncentiveInput.update({
      where: { id: inputId },
      data: updateData as any,
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_UPDATE',
      entityType: 'ShopManagerIncentiveInput',
      entityId: inputId,
      oldValue: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValue: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
