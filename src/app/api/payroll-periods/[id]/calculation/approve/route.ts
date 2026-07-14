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

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: { not: 'CANCELLED' } },
      orderBy: { version: 'desc' },
    })
    if (!batch) return badRequest('No calculation batch found')
    if (batch.status === 'APPROVED') return badRequest('Already approved')
    if (batch.calculatedById === session.userId) {
      const isSuperAdmin = await prisma.userRole.findFirst({
        where: { userId: session.userId, role: { name: 'SUPER_ADMIN' } },
      })
      if (!isSuperAdmin) return forbidden('Calculator cannot approve without SUPER_ADMIN override')
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.payrollPreparationBatch.update({
        where: { id: batch.id },
        data: { status: 'APPROVED', approvedById: session.userId, approvedAt: now },
      }),
      prisma.payrollPeriod.update({
        where: { id },
        data: { status: 'READY_FOR_REVIEW' },
      }),
    ])

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_APPROVE',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { batchId: batch.id, version: batch.version, status: 'APPROVED' },
    })
    return success({ batchId: batch.id, status: 'APPROVED' })
  } catch (e) { console.error(e); return internalError() }
}
