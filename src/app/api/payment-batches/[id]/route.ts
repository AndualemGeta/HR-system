import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentBatch.view'))) return forbidden()
    const { id } = await params
    const batch = await prisma.payrollPaymentBatch.findUnique({
      where: { id },
      include: { instructions: true },
    })
    if (!batch) return notFound()
    return success(batch)
  } catch (e) { console.error(e); return internalError() }
}
