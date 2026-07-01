import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['ALLOWANCE', 'DEDUCTION', 'COMMISSION', 'KPI', 'TRANSPORT', 'OVERTIME', 'BONUS', 'ADJUSTMENT', 'OTHER']),
  valueType: z.enum(['AMOUNT', 'NUMBER', 'PERCENTAGE', 'BOOLEAN', 'TEXT']),
  defaultAmount: z.number().optional(),
  requiresApproval: z.boolean().optional(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputType.view'))) return forbidden()

    const types = await prisma.payrollInputType.findMany({
      orderBy: { code: 'asc' },
    })

    return success(types)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputType.manage'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { code, name, description, category, valueType, defaultAmount, requiresApproval } = parsed.data

    const existing = await prisma.payrollInputType.findUnique({ where: { code } })
    if (existing) return badRequest(`Input type with code '${code}' already exists`)

    const inputType = await prisma.payrollInputType.create({
      data: {
        code,
        name,
        description,
        category,
        valueType,
        defaultAmount: defaultAmount !== undefined ? defaultAmount : null,
        requiresApproval: requiresApproval ?? false,
        createdById: session.userId,
        updatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_TYPE_CREATE',
      entityType: 'PayrollInputType',
      entityId: inputType.id,
      newValue: { code, name, category, valueType },
    })

    return success(inputType, 201)
  } catch (err) { console.error(err); return internalError() }
}
