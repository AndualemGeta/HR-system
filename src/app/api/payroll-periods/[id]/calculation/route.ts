import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.view'))) return forbidden()
    const { id } = await params

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: { not: 'CANCELLED' } },
      orderBy: { version: 'desc' },
      include: {
        rows: {
          orderBy: [{ readinessStatus: 'asc' }, { fullName: 'asc' }],
          take: 200,
        },
      },
    })
    if (!batch) return success({ batch: null, period })

    return success({
      batch: {
        ...batch,
        rows: undefined,
      },
      rows: batch.rows,
      period,
      summary: {
        totalEmployees: batch.employeeCount,
        grossEarningsTotal: batch.grossEarningsTotal,
        taxableIncomeTotal: batch.taxableIncomeTotal,
        employeePensionTotal: batch.employeePensionTotal,
        employerPensionTotal: batch.employerPensionTotal,
        payeTaxTotal: batch.payeTaxTotal,
        netSalaryTotal: batch.netSalaryTotal,
        employerTotalCost: batch.employerTotalCost,
        blockerCount: batch.blockerCount,
        warningCount: batch.warningCount,
      },
    })
  } catch (e) { console.error(e); return internalError() }
}
