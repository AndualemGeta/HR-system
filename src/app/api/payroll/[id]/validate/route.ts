import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { computePayroll } from '@/lib/payroll/mvp-calculations'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id } })
    if (rows.length === 0) return badRequest('No rows to validate')

    const periodStart = period.periodStart

    // Duplicate employee codes
    const dupSet = new Set<string>()
    const dupCodes = new Set<string>()
    for (const row of rows) {
      if (dupSet.has(row.employeeCode)) dupCodes.add(row.employeeCode)
      dupSet.add(row.employeeCode)
    }

    // Missing active/probation employees
    const activeEmployeeCodes = await prisma.employee.findMany({
      where: { employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } },
      select: { employeeId: true, fullName: true },
    })
    const existingCodes = new Set(rows.map(r => r.employeeCode))
    const missingEmployees = activeEmployeeCodes.filter(e => !existingCodes.has(e.employeeId))

    const globalBlockers: string[] = []
    const globalWarnings: string[] = []
    const employeeMessages: Record<string, { employeeName: string; blockers: string[]; warnings: string[] }> = {}

    for (const dupCode of dupCodes) {
      globalBlockers.push(`Duplicate employee code: ${dupCode}`)
    }

    if (missingEmployees.length > 0) {
      globalWarnings.push(`Missing ${missingEmployees.length} active employees (not yet snapshotted): ${missingEmployees.map(e => e.fullName).join(', ')}`)
    }

    for (const row of rows) {
      const msgs: string[] = []
      const warns: string[] = []
      const basic = Number(row.basicSalary || 0)
      const workingDays = Number(row.workingDays || 30)
      const monthlySalary = Number(row.monthlySalary || 0)
      const gross = Number(row.grossSalary || 0)
      const totalDed = Number(row.totalDeduction || 0)
      const net = Number(row.netSalary || 0)
      const commission = Number(row.commission || 0)
      const overtime = Number(row.overtime || 0)
      const incentive = Number(row.incentive || 0)
      const allowance = Number(row.allowance || 0)
      const shortageLoan = Number(row.otherDeduction || 0)

      // Employee identity
      if (!row.employeeCode) msgs.push('Missing employee code')
      if (!row.employeeName) msgs.push('Missing employee name')

      // Payroll group
      if (!row.payrollGroup) msgs.push('MISSING_PAYROLL_GROUP: Employee has no assigned payroll group')

      // Hire date / pension eligibility
      if (!row.hireDate) {
        msgs.push('MISSING_PENSION_ELIGIBILITY_DATE: No hire/registration date for employee')
      }

      // Numeric field checks
      if (basic <= 0) msgs.push('Basic salary must be greater than zero')
      if (workingDays <= 0 || workingDays > 31) msgs.push('Working days must be between 1 and 31')

      // Uncalculated fields
      if (monthlySalary <= 0) msgs.push('Monthly salary not calculated or zero — run Calculate')
      if (gross <= 0) msgs.push('Gross salary not calculated or zero — run Calculate')

      // Negative income tax
      if (Number(row.incomeTax) < 0) msgs.push('Income tax cannot be negative')

      // Missing snapshot data
      if (!row.snapshotJson) msgs.push('Missing snapshot data — run Snapshot first')

      // Payment method validation (warning for MVP Excel export)
      const pm = row.paymentMethod
      if (!pm) {
        warns.push('No payment method set — will default to HOLD')
      } else if (pm === 'BANK') {
        if (!row.bankName) warns.push('BANK payment selected but bank name is missing')
        if (!row.bankAccountNumber) warns.push('BANK payment selected but bank account number is missing')
      } else if (pm === 'MPESA') {
        if (!row.mpesaAccount) warns.push('MPESA payment selected but M-PESA account is missing')
      } else if (pm === 'CASH') {
      } else {
        warns.push(`Unknown payment method: ${pm}`)
      }

      // Tax ID (warning — Finance decision pending)
      const taxId = row.taxId || (() => {
        try {
          const snap = typeof row.snapshotJson === 'string' ? JSON.parse(row.snapshotJson) : row.snapshotJson
          return snap?.taxId || null
        } catch { return null }
      })()
      if (!taxId) warns.push('No tax ID on file for employee')

      // Pension ID rules:
      //   - warning during first two payroll months
      //   - blocker once pensionEligible=true and pensionId is missing
      const pensionId = row.pensionId || (() => {
        try {
          const snap = typeof row.snapshotJson === 'string' ? JSON.parse(row.snapshotJson) : row.snapshotJson
          return snap?.pensionId || null
        } catch { return null }
      })()
      if (!pensionId) {
        if (row.pensionEligible === true) {
          msgs.push('Pension ID is required — employee is eligible for pension')
        } else {
          const hireMonth = row.hireDate
            ? row.hireDate.getFullYear() * 12 + row.hireDate.getMonth()
            : null
          const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
          if (hireMonth !== null && payrollMonth < hireMonth + 2) {
            warns.push('Pension ID not yet required — within first two payroll months')
          } else {
            warns.push('No pension ID on file for employee')
          }
        }
      }

      // Reconcile persisted values against shared module
      const expected = computePayroll({
        basicSalary: basic,
        workingDays,
        commission,
        overtime,
        incentive,
        allowance,
        otherDeduction: shortageLoan,
        pensionEligible: row.pensionEligible === true,
      })

      if (monthlySalary > 0 && Math.abs(monthlySalary - expected.monthlySalary) > 1) {
        msgs.push(`Monthly salary (${monthlySalary}) differs from expected (${expected.monthlySalary}) — recalculate`)
      }
      if (gross > 0 && Math.abs(gross - expected.grossSalary) > 1) {
        msgs.push(`Gross salary (${gross}) differs from expected (${expected.grossSalary}) — recalculate`)
      }
      if (totalDed > 0 && Math.abs(totalDed - expected.totalDeduction) > 1) {
        msgs.push(`Total deduction (${totalDed}) differs from expected (${expected.totalDeduction}) — recalculate`)
      }
      if (net > 0 && Math.abs(net - expected.netSalary) > 1) {
        msgs.push(`Net salary (${net}) differs from expected (${expected.netSalary}) — recalculate`)
      }

      if (msgs.length > 0 || warns.length > 0) {
        employeeMessages[row.id] = {
          employeeName: row.employeeName,
          blockers: msgs,
          warnings: warns,
        }
        globalBlockers.push(...msgs)
        globalWarnings.push(...warns)
      }

      const status = msgs.length > 0 ? 'ERROR' : warns.length > 0 ? 'WARNING' : 'VALID'
      await prisma.mvpPayrollRow.update({
        where: { id: row.id },
        data: {
          validationStatus: status,
          validationMessages: JSON.stringify([...msgs, ...warns]),
        },
      })
    }

    const updatedRows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id },
      orderBy: { employeeName: 'asc' },
    })

    return success({
      blockers: [...new Set(globalBlockers)],
      warnings: [...new Set(globalWarnings)],
      blockerCount: globalBlockers.length,
      warningCount: globalWarnings.length,
      employees: employeeMessages,
      rows: updatedRows,
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}