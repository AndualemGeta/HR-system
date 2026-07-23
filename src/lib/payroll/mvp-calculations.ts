import Decimal from 'decimal.js'

export interface PayrollInput {
  basicSalary: number
  workingDays: number
  commission: number
  overtime: number
  incentive: number
  allowance: number
  otherDeduction: number
  pensionEligible: boolean
}

export interface PayrollOutput {
  monthlySalary: number
  commissionOt: number
  grossSalary: number
  taxableIncome: number
  incomeTax: number
  employeePension: number
  employerPension: number
  totalDeduction: number
  netSalary: number
}

function round2(v: Decimal): number {
  return v.toDecimalPlaces(2).toNumber()
}

export function calcIncomeTax(taxableIncome: Decimal): Decimal {
  if (taxableIncome.lte(2000)) return new Decimal(0)
  if (taxableIncome.lte(4000)) return taxableIncome.mul(0.15).minus(300)
  if (taxableIncome.lte(7000)) return taxableIncome.mul(0.20).minus(500)
  if (taxableIncome.lte(10000)) return taxableIncome.mul(0.25).minus(850)
  if (taxableIncome.lte(14000)) return taxableIncome.mul(0.30).minus(1350)
  return taxableIncome.mul(0.35).minus(2050)
}

export function computePayroll(input: PayrollInput): PayrollOutput {
  const basic = new Decimal(input.basicSalary)
  const workingDays = new Decimal(input.workingDays)
  const commission = new Decimal(input.commission)
  const overtime = new Decimal(input.overtime)
  const incentive = new Decimal(input.incentive)
  const allowance = new Decimal(input.allowance)
  const shortageLoan = new Decimal(input.otherDeduction)

  // Monthly = Basic / 30 × WorkingDays
  const monthlySalary = basic.div(30).mul(workingDays)

  // Commission/OT combined (for export column H)
  const commissionOt = commission.plus(overtime)

  // Gross = Monthly + Commission + Overtime + KPI
  const grossSalary = monthlySalary.plus(commission).plus(overtime).plus(incentive)

  // Taxable income = Gross salary
  const taxableIncome = grossSalary

  // Income tax (progressive brackets)
  const incomeTax = calcIncomeTax(taxableIncome)

  // Employee pension = Basic × 7% (only if eligible)
  const employeePension = input.pensionEligible ? basic.mul(0.07) : new Decimal(0)

  // Employer pension = Basic × 11% (only if eligible)
  const employerPension = input.pensionEligible ? basic.mul(0.11) : new Decimal(0)

  // Total deduction = Income tax + Employee pension + Shortage/Loan
  const totalDeduction = incomeTax.plus(employeePension).plus(shortageLoan)

  // Net = Gross - Total deduction + Transport/Other allowance
  const netSalary = grossSalary.minus(totalDeduction).plus(allowance)

  return {
    monthlySalary: round2(monthlySalary),
    commissionOt: round2(commissionOt),
    grossSalary: round2(grossSalary),
    taxableIncome: round2(taxableIncome),
    incomeTax: round2(incomeTax),
    employeePension: round2(employeePension),
    employerPension: round2(employerPension),
    totalDeduction: round2(totalDeduction),
    netSalary: round2(netSalary),
  }
}

export function computePensionEligible(hireDate: Date | null, periodStart: Date): boolean {
  if (!hireDate) return false
  const hireMonth = hireDate.getFullYear() * 12 + hireDate.getMonth()
  const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
  return payrollMonth >= hireMonth + 2
}
