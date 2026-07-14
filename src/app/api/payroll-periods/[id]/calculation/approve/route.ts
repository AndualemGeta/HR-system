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
    if (!(await userHasPermission(session.userId, 'payrollCalculation.approve'))) return forbidden()
    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'REVIEW_IN_PROGRESS') return badRequest(`Period status is ${period.status}, expected REVIEW_IN_PROGRESS`)

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: 'VALIDATED' },
      orderBy: { version: 'desc' },
    })
    if (!batch) return badRequest('No VALIDATED batch found to approve')
    if (!batch.reviewedById || !batch.reviewedAt) return badRequest('Batch must be reviewed/validated before approval')

    if (batch.calculatedById === session.userId) {
      return forbidden('Calculator cannot approve their own calculation')
    }
    if (batch.reviewedById === session.userId) {
      const isSuperAdmin = await prisma.userRole.findFirst({
        where: { userId: session.userId, role: { name: 'SUPER_ADMIN' } },
      })
      if (!isSuperAdmin) return forbidden('Reviewer cannot approve unless Super Admin')
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.payrollPreparationBatch.update({
        where: { id: batch.id },
        data: { status: 'APPROVED', approvedById: session.userId, approvedAt: now, lockedById: session.userId, lockedAt: now },
      }),
      prisma.payrollPeriod.update({
        where: { id },
        data: { status: 'APPROVED' },
      }),
    ])

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_APPROVE',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { batchId: batch.id, version: batch.version, oldStatus: 'REVIEW_IN_PROGRESS', newStatus: 'APPROVED' },
    })
    return success({ batchId: batch.id, status: 'APPROVED' })
  } catch (e) { console.error(e); return internalError() }
}
