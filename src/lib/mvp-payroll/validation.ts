import { computePayroll } from './calculation'
import type { MvpPayrollRow } from '@prisma/client'

export interface ValidationResult {
  status: 'VALID' | 'WARNING' | 'ERROR'
  blockers: string[]
  warnings: string[]
}

export function validateRow(
  row: MvpPayrollRow,
  periodStart: Date
): ValidationResult {
  const blockers: string[] = []
  const warnings: string[] = []

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

  if (!row.employeeCode) blockers.push('Missing employee code')
  if (!row.employeeName) blockers.push('Missing employee name')
  if (!row.payrollGroup) blockers.push('MISSING_PAYROLL_GROUP: Employee has no assigned payroll group')

  if (!row.hireDate) {
    blockers.push('MISSING_PENSION_ELIGIBILITY_DATE: No hire/registration date for employee')
  }

  if (basic <= 0) blockers.push('Basic salary must be greater than zero')
  if (workingDays <= 0 || workingDays > 31) blockers.push('Working days must be between 1 and 31')
  if (monthlySalary <= 0) blockers.push('Monthly salary not calculated or zero — run Calculate')
  if (gross <= 0) blockers.push('Gross salary not calculated or zero — run Calculate')
  if (Number(row.incomeTax) < 0) blockers.push('Income tax cannot be negative')
  if (!row.snapshotJson) blockers.push('Missing snapshot data — run Snapshot first')

  const pm = row.paymentMethod
  if (!pm) {
    warnings.push('No payment method set — will default to HOLD')
  } else if (pm === 'BANK') {
    if (!row.bankName) warnings.push('BANK payment selected but bank name is missing')
    if (!row.bankAccountNumber) warnings.push('BANK payment selected but bank account number is missing')
  } else if (pm === 'MPESA') {
    if (!row.mpesaAccount) warnings.push('MPESA payment selected but M-PESA account is missing')
  } else if (pm === 'MANUAL' || pm === 'CASH') {
    // MANUAL/CASH — no account warning
  } else if (pm === 'HOLD') {
    warnings.push('HOLD payment selected — salary will be held and not disbursed')
  } else {
    warnings.push(`Unknown payment method: ${pm}`)
  }

  if (!row.taxId) warnings.push('No tax ID on file for employee')

  if (!row.pensionId) {
    if (row.pensionEligible === true) {
      blockers.push('Pension ID is required — employee is eligible for pension')
    } else {
      const hireMonth = row.hireDate
        ? row.hireDate.getFullYear() * 12 + row.hireDate.getMonth()
        : null
      const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
      if (hireMonth !== null && payrollMonth < hireMonth + 2) {
        warnings.push('Pension ID not yet required — within first two payroll months')
      } else {
        warnings.push('No pension ID on file for employee')
      }
    }
  }

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
    blockers.push(`Monthly salary (${monthlySalary}) differs from expected (${expected.monthlySalary}) — recalculate`)
  }
  if (gross > 0 && Math.abs(gross - expected.grossSalary) > 1) {
    blockers.push(`Gross salary (${gross}) differs from expected (${expected.grossSalary}) — recalculate`)
  }
  if (totalDed > 0 && Math.abs(totalDed - expected.totalDeduction) > 1) {
    blockers.push(`Total deduction (${totalDed}) differs from expected (${expected.totalDeduction}) — recalculate`)
  }
  if (net > 0 && Math.abs(net - expected.netSalary) > 1) {
    blockers.push(`Net salary (${net}) differs from expected (${expected.netSalary}) — recalculate`)
  }

  let status: 'VALID' | 'WARNING' | 'ERROR'
  if (blockers.length > 0) status = 'ERROR'
  else if (warnings.length > 0) status = 'WARNING'
  else status = 'VALID'

  return { status, blockers, warnings }
}
