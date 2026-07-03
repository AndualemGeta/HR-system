import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/incentive-scope'

const updateInputSchema = z.object({
  shopLocationId: z.string().min(1).optional(),
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.view'))) return forbidden()

    const input = await prisma.shopManagerPerformanceInput.findUnique({
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
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        calculation: {
          include: {
            components: {
              orderBy: { componentCode: 'asc' },
            },
          },
        },
      },
    })

    if (!input) return notFound('Performance input not found')
    if (input.incentivePeriodId !== id) return notFound('Performance input not found in this period')

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    return success(input)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.input'))) return forbidden()

    const input = await prisma.shopManagerPerformanceInput.findUnique({
      where: { id: inputId },
    })
    if (!input) return notFound('Performance input not found')
    if (input.incentivePeriodId !== id) return notFound('Performance input not found in this period')

    if (input.inputStatus !== 'DRAFT' && input.inputStatus !== 'RETURNED') {
      return badRequest('Only inputs in DRAFT or RETURNED status can be updated')
    }

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = updateInputSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { shopLocationId, notes, ...performanceData } = parsed.data
    const updateData: Record<string, unknown> = {}

    if (notes !== undefined) updateData.notes = notes

    const performanceFields = [
      'qgaAchievementPercent', 'qgaCount', 'evdAchievementPercent', 'evdReconciled',
      'baSiteRequirementMet', 'mpesaFloatSold', 'mpesaTargetAchieved', 'mpesaReconciled',
      'dsaAirtimeAchievementPercent', 'mmQoTargetPercent', 'ebuTargetAchieved', 'ebuRevenue',
      'ebuAverageTopup', 'ebuFirstMonthLeapfrogRevenue',
    ] as const

    for (const field of performanceFields) {
      if ((performanceData as Record<string, unknown>)[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = (performanceData as Record<string, unknown>)[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest('No fields to update')
    }

    updateData.updatedById = session.userId

    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}
    for (const key of Object.keys(updateData)) {
      if (key === 'updatedById') continue
      oldValues[key] = (input as Record<string, unknown>)[key]
      newValues[key] = updateData[key]
    }

    const updated = await prisma.shopManagerPerformanceInput.update({
      where: { id: inputId },
      data: updateData,
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_UPDATE',
      entityType: 'ShopManagerPerformanceInput',
      entityId: inputId,
      oldValue: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValue: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
