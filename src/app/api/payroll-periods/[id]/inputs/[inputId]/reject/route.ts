import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { assertPayrollInputInUserScope } from '@/lib/payroll-scope'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const rejectSchema = z.object({
  note: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.review'))) return forbidden()

    const input = await prisma.payrollInput.findUnique({ where: { id: inputId, payrollPeriodId: id } })
    if (!input) return notFound('Input record not found')
    if (input.status !== 'SUBMITTED') return badRequest('Only SUBMITTED inputs can be rejected')

    const scopeCheck = await assertPayrollInputInUserScope(session.userId, inputId)
    if (!scopeCheck.allowed) return forbidden(scopeCheck.error)

    const body = await req.json().catch(() => ({}))
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { note } = parsed.data

    const updated = await prisma.payrollInput.update({
      where: { id: inputId },
      data: {
        status: 'REJECTED',
        ...(note !== undefined ? { note } : {}),
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_REJECT',
      entityType: 'PayrollInput',
      entityId: inputId,
      oldValue: { status: input.status },
      newValue: { status: 'REJECTED', note },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
