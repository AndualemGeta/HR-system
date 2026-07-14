import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.return'))) return forbidden()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (!body.reason) return badRequest('Reason is required to return a calculation')
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'REVIEW_IN_PROGRESS') return badRequest(`Period is ${period.status}, expected REVIEW_IN_PROGRESS`)

    const targetStatus = body.returnToOpen ? 'OPEN_FOR_INPUT' : 'REVIEW_IN_PROGRESS'
    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: { status: targetStatus },
    })
    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_RETURN',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { oldStatus: period.status, newStatus: targetStatus, reason: body.reason },
    })
    return success({ period: updated, reason: body.reason })
  } catch (e) { console.error(e); return internalError() }
}
