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

    const body = await req.json().catch(() => ({}))
    const { reason } = body
    if (!reason) return badRequest('Reopen reason is required')

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'LOCKED') return badRequest('Only locked periods can be reopened')

    const updated = await prisma.mvpPayrollPeriod.update({
      where: { id },
      data: {
        status: 'DRAFT',
        reopenReason: reason,
        reopenedById: session.userId,
        reopenedAt: new Date(),
        readyById: null,
        readyAt: null,
        lockedById: null,
        lockedAt: null,
      },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_ADJUSTMENT', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { status: 'DRAFT', reopenReason: reason },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
