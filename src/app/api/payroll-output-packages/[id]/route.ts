import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollFinalization.view'))) return forbidden()

    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({
      where: { id },
      include: {
        payslipSnapshots: { select: { id: true, employeeCode: true, fullName: true, netSalary: true, documentHash: true, publishedAt: true } },
        paymentBatches: { select: { id: true, status: true, paymentMethod: true, totalAmount: true, employeeCount: true, batchReference: true } },
        statutoryReports: true,
        journalBatches: { include: { lines: true } },
        exportRecords: true,
      },
    })
    if (!pkg) return notFound()
    return success(pkg)
  } catch (e) { console.error(e); return internalError() }
}
