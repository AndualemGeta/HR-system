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
    if (!(await userHasPermission(session.userId, 'payrollPeriod.close'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY') return badRequest('Period must be READY before locking')

    const updated = await prisma.mvpPayrollPeriod.update({
      where: { id },
      data: { status: 'LOCKED', lockedById: session.userId, lockedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_PERIOD_LOCK', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { status: 'LOCKED' },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
