import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  value: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.create'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'OPEN_FOR_INPUT') return badRequest('Inputs can only be edited in OPEN_FOR_INPUT periods')

    const input = await prisma.payrollInput.findUnique({ where: { id: inputId, payrollPeriodId: id } })
    if (!input) return notFound('Input record not found')
    if (input.status !== 'DRAFT' && input.status !== 'RETURNED') return badRequest('Only DRAFT or RETURNED inputs can be edited')

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { value, amount, note } = parsed.data

    const updateData: Record<string, unknown> = {}
    if (value !== undefined) updateData.value = value
    if (amount !== undefined) updateData.amount = amount
    if (note !== undefined) updateData.note = note

    const updated = await prisma.payrollInput.update({
      where: { id: inputId },
      data: updateData,
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_UPDATE',
      entityType: 'PayrollInput',
      entityId: inputId,
      oldValue: { value: input.value?.toString(), amount: input.amount?.toString(), status: input.status },
      newValue: { value: updated.value?.toString(), amount: updated.amount?.toString() },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
