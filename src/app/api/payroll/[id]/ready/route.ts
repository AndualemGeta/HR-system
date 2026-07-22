import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id }, include: { _count: { select: { rows: true } } } })
    if (!period) return notFound()
    if (period.status !== 'DRAFT') return badRequest('Period must be in DRAFT status')

    const rowCount = period._count.rows
    if (rowCount === 0) return badRequest('No employee rows to prepare. Run snapshot first.')

    const updated = await prisma.mvpPayrollPeriod.update({
      where: { id },
      data: { status: 'READY', readyById: session.userId, readyAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_PERIOD_CLOSE', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { status: 'READY' },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
