import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  inputLabel: z.string().min(1).optional(),
  ownerDepartment: z.string().min(1).optional(),
  ownerRole: z.string().min(1).optional(),
  inputType: z.string().min(1).optional(),
  allowedValues: z.string().nullable().optional(),
  usedInComponent: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  blocksCalculation: z.boolean().optional(),
  blocksPayrollHandoff: z.boolean().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  helpText: z.string().nullable().optional(),
  requiredWhenJson: z.string().nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.viewInputConfig'))) return forbidden()

    const config = await prisma.shopManagerIncentiveInputConfig.findUnique({ where: { id } })
    if (!config) return notFound('Input config not found')

    return success(config)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.manageInputConfig'))) return forbidden()

    const existing = await prisma.shopManagerIncentiveInputConfig.findUnique({ where: { id } })
    if (!existing) return notFound('Input config not found')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { inputLabel, ownerDepartment, ownerRole, inputType, allowedValues, usedInComponent, displayOrder, isActive, isRequired, blocksCalculation, blocksPayrollHandoff, minValue, maxValue, helpText, requiredWhenJson } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (inputLabel !== undefined) updateData.inputLabel = inputLabel
    if (ownerDepartment !== undefined) updateData.ownerDepartment = ownerDepartment
    if (ownerRole !== undefined) updateData.ownerRole = ownerRole
    if (inputType !== undefined) updateData.inputType = inputType
    if (allowedValues !== undefined) updateData.allowedValues = allowedValues
    if (usedInComponent !== undefined) updateData.usedInComponent = usedInComponent
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder
    if (isActive !== undefined) updateData.isActive = isActive
    if (isRequired !== undefined) updateData.isRequired = isRequired
    if (blocksCalculation !== undefined) updateData.blocksCalculation = blocksCalculation
    if (blocksPayrollHandoff !== undefined) updateData.blocksPayrollHandoff = blocksPayrollHandoff
    if (minValue !== undefined) updateData.minValue = minValue
    if (maxValue !== undefined) updateData.maxValue = maxValue
    if (helpText !== undefined) updateData.helpText = helpText
    if (requiredWhenJson !== undefined) updateData.requiredWhenJson = requiredWhenJson

    if (Object.keys(updateData).length === 0) return badRequest('No fields to update')

    const updated = await prisma.shopManagerIncentiveInputConfig.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_UPDATE',
      entityType: 'ShopManagerIncentiveInputConfig',
      entityId: id,
      oldValue: { inputLabel: existing.inputLabel, isActive: existing.isActive },
      newValue: { inputLabel: updated.inputLabel, isActive: updated.isActive },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}


