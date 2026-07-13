import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, conflict, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  inputCode: z.string().min(1),
  inputLabel: z.string().min(1),
  ownerDepartment: z.string().min(1),
  ownerRole: z.string().min(1),
  inputType: z.string().min(1),
  allowedValues: z.string().nullable().optional(),
  usedInComponent: z.string().nullable().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().optional().default(true),
  isRequired: z.boolean().optional().default(false),
  blocksCalculation: z.boolean().optional().default(false),
  blocksPayrollHandoff: z.boolean().optional().default(false),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  helpText: z.string().nullable().optional(),
  requiredWhenJson: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.viewInputConfig'))) return forbidden()

    const configs = await prisma.shopManagerIncentiveInputConfig.findMany({
      orderBy: { displayOrder: 'asc' },
    })

    return success(configs)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.manageInputConfig'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { inputCode, inputLabel, ownerDepartment, ownerRole, inputType, allowedValues, usedInComponent, displayOrder, isActive, isRequired, blocksCalculation, blocksPayrollHandoff, minValue, maxValue, helpText, requiredWhenJson } = parsed.data

    const existing = await prisma.shopManagerIncentiveInputConfig.findUnique({ where: { inputCode } })
    if (existing) return conflict('An input config with this code already exists')

    const allowedCodes = [
      'SHOP_CRITERIA', 'QGA_ABOVE_90', 'QGA_QUANTITY', 'MM_QO_ABOVE_90',
      'DSA_AIRTIME_PERCENT', 'CORRIDOR_STATUS', 'EVD_ABOVE_100',
      'MPESA_TARGET', 'MPESA_FLOAT_SOLD', 'BA_SITE',
      'EBU_TARGET_ACHIEVED', 'EBU_REVENUE_MADE', 'EBU_AVG_TOPUP_ABOVE_500',
      'EBU_FIRST_MONTH_LF_REVENUE', 'RESPONSIBLE_REMARKS',
    ]
    if (!allowedCodes.includes(inputCode)) {
      return badRequest('Cannot create unsupported input code. Allowed codes: ' + allowedCodes.join(', '))
    }

    const config = await prisma.shopManagerIncentiveInputConfig.create({
      data: {
        inputCode,
        inputLabel,
        ownerDepartment,
        ownerRole,
        inputType,
        allowedValues: allowedValues ?? null,
        usedInComponent: usedInComponent ?? null,
        displayOrder,
        isActive,
        isRequired,
        blocksCalculation,
        blocksPayrollHandoff,
        minValue: minValue ?? null,
        maxValue: maxValue ?? null,
        helpText: helpText ?? null,
        requiredWhenJson: requiredWhenJson ?? null,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_UPDATE',
      entityType: 'ShopManagerIncentiveInputConfig',
      entityId: config.id,
      newValue: { inputCode, inputLabel, ownerDepartment, ownerRole, inputType, displayOrder },
    })

    return success(config, 201)
  } catch (err) { console.error(err); return internalError() }
}
