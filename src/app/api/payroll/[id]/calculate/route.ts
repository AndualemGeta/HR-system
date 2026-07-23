import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { computePayroll } from '@/lib/payroll/mvp-calculations'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status === 'LOCKED') return badRequest('Period is LOCKED. Reopen to DRAFT before calculating.')
    if (period.status !== 'DRAFT' && period.status !== 'READY') return badRequest('Period must be DRAFT or READY')

    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id } })
    if (rows.length === 0) return badRequest('No rows to calculate')

    for (const row of rows) {
      const result = computePayroll({
        basicSalary: Number(row.basicSalary || 0),
        workingDays: Number(row.workingDays || 30),
        commission: Number(row.commission || 0),
        overtime: Number(row.overtime || 0),
        incentive: Number(row.incentive || 0),
        allowance: Number(row.allowance || 0),
        otherDeduction: Number(row.otherDeduction || 0),
        pensionEligible: row.pensionEligible === true,
      })

      await prisma.mvpPayrollRow.update({
        where: { id: row.id },
        data: {
          monthlySalary: result.monthlySalary,
          grossSalary: result.grossSalary,
          taxableIncome: result.taxableIncome,
          incomeTax: result.incomeTax,
          employeePension: result.employeePension,
          employerPension: result.employerPension,
          totalDeduction: result.totalDeduction,
          netSalary: result.netSalary,
        },
      })
    }

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_BATCH_CREATE', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { rowsCalculated: rows.length },
    })

    const recalculated = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id },
      orderBy: { employeeName: 'asc' },
    })

    return success({ rows: recalculated, calculated: rows.length })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
