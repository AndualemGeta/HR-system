import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  minIncome: z.number().min(0).optional(),
  maxIncome: z.number().min(0).nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  deductionAmount: z.number().min(0).optional(),
  effectiveStartDate: z.string().min(1).optional(),
  effectiveEndDate: z.string().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.view'))) return forbidden()
    const { id } = await params
    const bracket = await prisma.payeTaxBracket.findUnique({ where: { id } })
    if (!bracket) return notFound()
    return success(bracket)
  } catch (e) { console.error(e); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.manage'))) return forbidden()
    const { id } = await params
    const existing = await prisma.payeTaxBracket.findUnique({ where: { id } })
    if (!existing) return notFound()
    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const d = parsed.data
    const updateData: Record<string, unknown> = {}
    if (d.name !== undefined) updateData.name = d.name
    if (d.minIncome !== undefined) updateData.minIncome = d.minIncome
    if (d.maxIncome !== undefined) updateData.maxIncome = d.maxIncome
    if (d.taxRate !== undefined) updateData.taxRate = d.taxRate
    if (d.deductionAmount !== undefined) updateData.deductionAmount = d.deductionAmount
    if (d.effectiveStartDate !== undefined) updateData.effectiveStartDate = new Date(d.effectiveStartDate)
    if (d.effectiveEndDate !== undefined) updateData.effectiveEndDate = d.effectiveEndDate ? new Date(d.effectiveEndDate) : null
    const bracket = await prisma.payeTaxBracket.update({ where: { id }, data: updateData })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PAYE_UPDATE', entityType: 'PayeTaxBracket', entityId: id, newValue: updateData, oldValue: { name: existing.name } })
    return success(bracket)
  } catch (e) { console.error(e); return internalError() }
}
