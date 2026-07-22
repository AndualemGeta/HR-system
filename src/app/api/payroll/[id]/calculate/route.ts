import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import Decimal from 'decimal.js'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'DRAFT' && period.status !== 'READY') return badRequest('Period must be DRAFT or READY')

    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id } })
    if (rows.length === 0) return badRequest('No rows to calculate')

    for (const row of rows) {
      const basic = new Decimal(row.basicSalary || 0)
      const allowance = new Decimal(row.allowance || 0)
      const overtime = new Decimal(row.overtime || 0)
      const incentive = new Decimal(row.incentive || 0)
      const commission = new Decimal(row.commission || 0)

      const grossSalary = basic.plus(allowance).plus(overtime).plus(incentive).plus(commission)

      const empPension = new Decimal(row.employeePension || 0)
      const incomeTax = new Decimal(row.incomeTax || 0)
      const otherDed = new Decimal(row.otherDeduction || 0)
      const totalDeduction = empPension.plus(incomeTax).plus(otherDed)

      const netSalary = grossSalary.minus(totalDeduction)

      await prisma.mvpPayrollRow.update({
        where: { id: row.id },
        data: {
          grossSalary: grossSalary.toDecimalPlaces(2).toNumber(),
          totalDeduction: totalDeduction.toDecimalPlaces(2).toNumber(),
          netSalary: netSalary.toDecimalPlaces(2).toNumber(),
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
