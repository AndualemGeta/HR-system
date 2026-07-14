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
    if (!(await userHasPermission(session.userId, 'payrollCalculation.validate'))) return forbidden()
    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'REVIEW_IN_PROGRESS') return badRequest(`Period is ${period.status}, expected REVIEW_IN_PROGRESS`)

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: 'DRAFT' },
      orderBy: { version: 'desc' },
    })
    if (!batch) return badRequest('No DRAFT batch found to validate')
    if (batch.blockerCount && batch.blockerCount > 0) return badRequest('Cannot validate batch with blockers')

    const now = new Date()
    await prisma.payrollPreparationBatch.update({
      where: { id: batch.id },
      data: {
        status: 'VALIDATED',
        reviewedById: session.userId,
        reviewedAt: now,
      },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_VALIDATE',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { batchId: batch.id, version: batch.version, status: 'VALIDATED' },
    })
    return success({ batchId: batch.id, status: 'VALIDATED' })
  } catch (e) { console.error(e); return internalError() }
}
