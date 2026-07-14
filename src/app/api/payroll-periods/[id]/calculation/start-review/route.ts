import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.review'))) return forbidden()
    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY_FOR_REVIEW') return badRequest(`Period is ${period.status}, expected READY_FOR_REVIEW`)
    const updated = await prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'REVIEW_IN_PROGRESS' },
    })
    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_REVIEW_START',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { oldStatus: period.status, newStatus: 'REVIEW_IN_PROGRESS' },
    })
    return success(updated)
  } catch (e) { console.error(e); return internalError() }
}
