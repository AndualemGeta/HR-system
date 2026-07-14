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

    const newVersion = (batch?.version ?? 0) + 1
    const needsFinanceAuth = batch?.status === 'APPROVED'

    if (needsFinanceAuth) {
      const canApprove = await userHasPermission(session.userId, 'payrollCalculation.approve')
      if (!canApprove) return forbidden('Approved calculation can only be reopened by Finance Director or Super Admin')
    }

    await prisma.$transaction(async (tx) => {
      if (batch) {
        await tx.payrollPreparationBatch.update({
          where: { id: batch.id },
          data: {
            status: 'CANCELLED',
            calculationStatus: 'SUPERSEDED',
            notes: `Superseded by reopen: ${body.reason}`,
          },
        })
      }

      const targetStatus = body.returnToInput === false ? 'READY_FOR_CALCULATION' : 'OPEN_FOR_INPUT'
      await tx.payrollPeriod.update({
        where: { id },
        data: { status: targetStatus },
      })
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_REOPEN',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { reason: body.reason, newVersion, oldStatus: period.status, newStatus: body.returnToInput === false ? 'READY_FOR_CALCULATION' : 'OPEN_FOR_INPUT' },
    })

    return success({ newVersion, status: body.returnToInput === false ? 'READY_FOR_CALCULATION' : 'OPEN_FOR_INPUT', reason: body.reason })
  } catch (e) { console.error(e); return internalError() }
}
