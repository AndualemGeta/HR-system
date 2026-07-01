import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.review'))) return forbidden()

    const input = await prisma.payrollInput.findUnique({ where: { id: inputId, payrollPeriodId: id } })
    if (!input) return notFound('Input record not found')
    if (input.status !== 'SUBMITTED') return badRequest('Only SUBMITTED inputs can be accepted')

    const updated = await prisma.payrollInput.update({
      where: { id: inputId },
      data: { status: 'ACCEPTED' },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_ACCEPT',
      entityType: 'PayrollInput',
      entityId: inputId,
      oldValue: { status: input.status },
      newValue: { status: 'ACCEPTED' },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
