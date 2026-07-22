import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
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

    // Check for duplicate employees within the same period
    const dupSet = new Set<string>()
    const dupCodes = new Set<string>()
    for (const row of rows) {
      if (dupSet.has(row.employeeCode)) dupCodes.add(row.employeeCode)
      dupSet.add(row.employeeCode)
    }

    // Check for missing active employees (employees not in this payroll period)
    const activeEmployeeCodes = await prisma.employee.findMany({
      where: { employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } },
      select: { employeeId: true, fullName: true },
    })
    const existingCodes = new Set(rows.map(r => r.employeeCode))
    const missingEmployees = activeEmployeeCodes.filter(e => !existingCodes.has(e.employeeId))

    const blockers: string[] = []
    const warnings: string[] = []
    const employeeMessages: Record<string, { employeeName: string; blockers: string[]; warnings: string[] }> = {}

    // Global duplicate employee check
    for (const dupCode of dupCodes) {
      blockers.push(`Duplicate employee code: ${dupCode}`)
    }

    // Missing active employees warning
    if (missingEmployees.length > 0) {
      warnings.push(`Missing ${missingEmployees.length} active employees (not yet snapshotted): ${missingEmployees.map(e => e.fullName).join(', ')}`)
    }

    for (const row of rows) {
      const msgs: string[] = []
      const warns: string[] = []
      const basic = Number(row.basicSalary || 0)
      const workingDays = Number(row.workingDays || 30)
      const gross = Number(row.grossSalary || 0)
      const totalDed = Number(row.totalDeduction || 0)
      const net = Number(row.netSalary || 0)

      // Employee identity
      if (!row.employeeCode) msgs.push('Missing employee code')
      if (!row.employeeName) msgs.push('Missing employee name')

      // Numeric field checks
      if (basic <= 0) msgs.push('Basic salary must be greater than zero')
      if (workingDays <= 0 || workingDays > 31) msgs.push('Working days must be between 1 and 31')

      // Pension eligibility
      if (!row.hireDate) msgs.push('MISSING_PENSION_ELIGIBILITY_DATE: No hire/registration date for employee')

      // Calculated field checks
      if (gross <= 0) msgs.push('Gross salary not calculated or zero')
      if (net < 0) warns.push('Net salary is negative')
      if (Number(row.incomeTax) < 0) msgs.push('Income tax cannot be negative')
      if (Number(row.employeePension) < 0) warns.push('Employee pension is negative')
      if (Number(row.otherDeduction) < 0) warns.push('Shortage/loan deduction is negative')

      // Payment method validation
      const pm = row.paymentMethod
      if (!pm) {
        warns.push('No payment method set')
      } else if (pm === 'BANK') {
        if (!row.bankName) warns.push('BANK payment selected but bank name is missing')
        if (!row.bankAccountNumber) warns.push('BANK payment selected but bank account number is missing')
      } else if (pm === 'MPESA') {
        if (!row.mpesaAccount) warns.push('MPESA payment selected but M-PESA account is missing')
      } else if (pm === 'CASH') {
        // CASH requires no extra info
      } else {
        warns.push(`Unknown payment method: ${pm}`)
      }

      // Tax and pension ID warnings
      if (!row.snapshotJson) {
        warns.push('Missing snapshot — run snapshot first')
      } else {
        try {
          const snap = typeof row.snapshotJson === 'string' ? JSON.parse(row.snapshotJson) : row.snapshotJson
          if (!snap.taxId) warns.push('No tax ID on file for employee')
          if (!snap.pensionId) warns.push('No pension ID on file for employee')
        } catch {
          warns.push('Could not parse snapshot data')
        }
      }

      // Monthly salary reconciliation (Monthly = Basic / 30 × Working Days)
      const monthlyCalc = Math.round((basic / 30) * workingDays * 100) / 100
      const monthlySalary = Number(row.monthlySalary || 0)
      if (monthlySalary > 0 && Math.abs(monthlySalary - monthlyCalc) > 1) {
        warns.push(`Monthly salary (${monthlySalary}) differs from Basic/30×Days (${monthlyCalc})`)
      }

      // Gross reconciliation: Gross = Monthly + Commission/OT + KPI
      const commission = Number(row.commission || 0)
      const overtime = Number(row.overtime || 0)
      const incentive = Number(row.incentive || 0)
      const expectedGross = Math.round((monthlyCalc + commission + overtime + incentive) * 100) / 100
      if (gross > 0 && Math.abs(gross - expectedGross) > 1) {
        msgs.push(`Gross salary (${gross}) differs from Monthly+Comm/OT+KPI (${expectedGross})`)
      }

      // Deduction reconciliation: Total Deduction = Tax + Employee Pension + Shortage/Loan
      const incomeTax = Number(row.incomeTax || 0)
      const empPension = Number(row.employeePension || 0)
      const shortageLoan = Number(row.otherDeduction || 0)
      const expectedTotalDed = Math.round((incomeTax + empPension + shortageLoan) * 100) / 100
      if (totalDed > 0 && Math.abs(totalDed - expectedTotalDed) > 1) {
        msgs.push(`Total deduction (${totalDed}) differs from Tax+Pension+Loan (${expectedTotalDed})`)
      }

      // Net reconciliation: Net = Gross - Total Deduction + Transport Allowance
      const allowance = Number(row.allowance || 0)
      const expectedNet = Math.round((gross - totalDed + allowance) * 100) / 100
      if (net > 0 && Math.abs(net - expectedNet) > 1) {
        msgs.push(`Net salary (${net}) differs from Gross-TotalDed+Allowance (${expectedNet})`)
      }

      if (msgs.length > 0 || warns.length > 0) {
        employeeMessages[row.id] = {
          employeeName: row.employeeName,
          blockers: msgs,
          warnings: warns,
        }
        blockers.push(...msgs)
        warnings.push(...warns)
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
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)],
      blockerCount: blockers.length,
      warningCount: warnings.length,
      employees: employeeMessages,
      rows: updatedRows,
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
