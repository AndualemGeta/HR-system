import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { assertPayrollInputInUserScope } from '@/lib/payroll-scope'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.submit'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'OPEN_FOR_INPUT') return badRequest('Inputs can only be submitted in OPEN_FOR_INPUT periods')

    const input = await prisma.payrollInput.findUnique({ where: { id: inputId, payrollPeriodId: id } })
    if (!input) return notFound('Input record not found')
    if (input.isLocked) return badRequest('Input is locked and cannot be submitted')
    if (input.status !== 'DRAFT' && input.status !== 'RETURNED') return badRequest('Only DRAFT or RETURNED inputs can be submitted')

    const scopeCheck = await assertPayrollInputInUserScope(session.userId, inputId)
    if (!scopeCheck.allowed) return forbidden(scopeCheck.error)

    const updated = await prisma.payrollInput.update({
      where: { id: inputId },
      data: {
        status: 'SUBMITTED',
        submittedById: session.userId,
        submittedAt: new Date(),
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_SUBMIT',
      entityType: 'PayrollInput',
      entityId: inputId,
      oldValue: { status: input.status },
      newValue: { status: 'SUBMITTED' },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
