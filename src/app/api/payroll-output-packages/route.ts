import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollFinalization.view'))) return forbidden()

    const packages = await prisma.payrollOutputPackage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        payslipSnapshots: { select: { id: true } },
        paymentBatches: { select: { id: true, status: true, paymentMethod: true } },
        statutoryReports: { select: { id: true, reportType: true, status: true } },
        journalBatches: { select: { id: true, status: true } },
      },
    })
    return success(packages)
  } catch (e) { console.error(e); return internalError() }
}
