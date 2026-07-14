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

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: 'DRAFT' },
      orderBy: { version: 'desc' },
    })
    if (!batch) return badRequest('No DRAFT batch found to return')

    const targetStatus = body.returnToInput !== false ? 'OPEN_FOR_INPUT' : 'READY_FOR_CALCULATION'

    await prisma.$transaction([
      prisma.payrollPreparationBatch.update({
        where: { id: batch.id },
        data: {
          status: 'CANCELLED',
          calculationStatus: 'SUPERSEDED',
          notes: `Returned: ${body.reason}`,
        },
      }),
      prisma.payrollPeriod.update({
        where: { id },
        data: { status: targetStatus },
      }),
    ])

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_RETURN',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { batchId: batch.id, oldStatus: period.status, newStatus: targetStatus, reason: body.reason },
    })
    return success({ status: targetStatus, reason: body.reason })
  } catch (e) { console.error(e); return internalError() }
}
