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
    if (!(await userHasPermission(session.userId, 'payrollCalculation.reopen'))) return forbidden()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (!body.reason) return badRequest('Reason is required to reopen calculation')

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: { not: 'CANCELLED' } },
      orderBy: { version: 'desc' },
    })
    if (batch?.status === 'APPROVED') {
      const isSuperAdmin = await prisma.userRole.findFirst({
        where: { userId: session.userId, role: { name: 'SUPER_ADMIN' } },
      })
      if (!isSuperAdmin && !(await userHasPermission(session.userId, 'payrollCalculation.approve'))) {
        return forbidden('Approved calculation can only be reopened by Finance Director or Super Admin')
      }
      await prisma.payrollPreparationBatch.update({
        where: { id: batch.id },
        data: { status: 'CANCELLED' },
      })
    }

    const newVersion = (batch?.version ?? 0) + 1
    await prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'OPEN_FOR_INPUT' },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_REOPEN',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { reason: body.reason, newVersion, oldStatus: period.status, newStatus: 'OPEN_FOR_INPUT' },
    })
    return success({ newVersion, status: 'OPEN_FOR_INPUT', reason: body.reason })
  } catch (e) { console.error(e); return internalError() }
}
