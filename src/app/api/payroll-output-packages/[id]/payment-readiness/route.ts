import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { evaluatePaymentReadiness } from '@/lib/payroll/payment'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.view'))) return forbidden()

    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id } })
    if (!pkg) return notFound()

    const readiness = await evaluatePaymentReadiness(id)
    return success(readiness)
  } catch (e) { console.error(e); return internalError() }
}
