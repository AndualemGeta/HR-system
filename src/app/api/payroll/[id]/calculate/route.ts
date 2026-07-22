import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import Decimal from 'decimal.js'

// Progressive tax brackets from the company workbook
// Tax = rate × (income − threshold)+ fixedDeduction (or rate × income − fixedDeduction)
function calcIncomeTax(taxableIncome: Decimal): Decimal {
  if (taxableIncome.lte(2000)) return new Decimal(0)
  if (taxableIncome.lte(4000)) return taxableIncome.mul(0.15).minus(300)
  if (taxableIncome.lte(7000)) return taxableIncome.mul(0.20).minus(500)
  if (taxableIncome.lte(10000)) return taxableIncome.mul(0.25).minus(850)
  if (taxableIncome.lte(14000)) return taxableIncome.mul(0.30).minus(1350)
  return taxableIncome.mul(0.35).minus(2050)
}

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
      const workingDays = new Decimal(row.workingDays || 30)
      const allowance = new Decimal(row.allowance || 0)
      const overtime = new Decimal(row.overtime || 0)
      const incentive = new Decimal(row.incentive || 0)
      const commission = new Decimal(row.commission || 0)
      const shortageLoan = new Decimal(row.otherDeduction || 0)

      // Monthly salary = Basic / 30 × Working days
      const monthlySalary = basic.div(30).mul(workingDays).toDecimalPlaces(2)

      // Commission/OT = Commission + Overtime (combined)
      const commissionOt = commission.plus(overtime)

      // Gross = MonthlySalary + Commission/OT + KPI
      const grossSalary = monthlySalary.plus(commissionOt).plus(incentive)

      // Taxable income = Gross salary
      const taxableIncome = grossSalary

      // Income tax (progressive brackets)
      const incomeTax = calcIncomeTax(taxableIncome).toDecimalPlaces(2)

      // Employee pension = Basic × 7% (only if pension eligible)
      const employeePension = row.pensionEligible
        ? basic.mul(0.07).toDecimalPlaces(2)
        : new Decimal(0)

      // Employer pension = Basic × 11% (only if pension eligible)
      const employerPension = row.pensionEligible
        ? basic.mul(0.11).toDecimalPlaces(2)
        : new Decimal(0)

      // Total deduction = Income tax + Employee pension + Shortage/Loan
      const totalDeduction = incomeTax.plus(employeePension).plus(shortageLoan).toDecimalPlaces(2)

      // Net pay = Gross - Total deduction + Transport/Other allowance
      const netSalary = grossSalary.minus(totalDeduction).plus(allowance).toDecimalPlaces(2)

      await prisma.mvpPayrollRow.update({
        where: { id: row.id },
        data: {
          monthlySalary: monthlySalary.toNumber(),
          grossSalary: grossSalary.toNumber(),
          taxableIncome: taxableIncome.toNumber(),
          incomeTax: incomeTax.toNumber(),
          employeePension: employeePension.toNumber(),
          employerPension: employerPension.toNumber(),
          totalDeduction: totalDeduction.toNumber(),
          netSalary: netSalary.toNumber(),
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
