import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.open'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'DRAFT') return badRequest('Only DRAFT periods can be opened for input')

    const existingOpen = await prisma.payrollPeriod.findFirst({
      where: { status: 'OPEN_FOR_INPUT', id: { not: id } },
    })
    if (existingOpen) return badRequest('Only one OPEN_FOR_INPUT period is allowed at a time')

    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'OPEN_FOR_INPUT', updatedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PERIOD_OPEN',
      entityType: 'PayrollPeriod',
      entityId: id,
      oldValue: { status: period.status },
      newValue: { status: updated.status },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
