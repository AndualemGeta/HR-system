import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  scheduleCode: z.string().min(1),
  minIncome: z.number().min(0),
  maxIncome: z.number().min(0).nullable().optional(),
  taxRate: z.number().min(0).max(100),
  deductionAmount: z.number().min(0).default(0),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.view'))) return forbidden()
    const brackets = await prisma.payeTaxBracket.findMany({ orderBy: [{ effectiveStartDate: 'desc' }, { minIncome: 'asc' }] })
    return success(brackets)
  } catch (e) { console.error(e); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.manage'))) return forbidden()
    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const d = parsed.data
    const bracket = await prisma.payeTaxBracket.create({
      data: {
        name: d.name,
        scheduleCode: d.scheduleCode,
        minIncome: d.minIncome,
        maxIncome: d.maxIncome ?? null,
        taxRate: d.taxRate,
        deductionAmount: d.deductionAmount,
        effectiveStartDate: new Date(d.effectiveStartDate),
        effectiveEndDate: d.effectiveEndDate ? new Date(d.effectiveEndDate) : null,
        isActive: true,
        approvalStatus: 'DRAFT',
        createdById: session.userId,
      },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PAYE_CREATE', entityType: 'PayeTaxBracket', entityId: bracket.id, newValue: { name: d.name } })
    return success(bracket)
  } catch (e) { console.error(e); return internalError() }
}
