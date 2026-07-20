import { prisma } from '@/lib/prisma'
import { roundMoney, money } from '@/lib/money'
import type { SalaryResolution } from './types'

export function mapSalarySourceToCalculationSource(salarySource: string): 'EMPLOYEE_SALARY' | 'SYSTEM' {
  if (salarySource === 'EmployeeSalary') return 'EMPLOYEE_SALARY'
  if (salarySource === 'Employee.basicSalary') return 'SYSTEM'
  return 'SYSTEM'
}

export async function resolveSalary(employeeId: string, periodEnd: Date): Promise<SalaryResolution> {
  const salary = await prisma.employeeSalary.findFirst({
    where: { employeeId, effectiveDate: { lte: periodEnd } },
    orderBy: { effectiveDate: 'desc' },
  })
  if (salary) {
    return {
      basicSalary: Number(salary.basicSalary),
      salarySource: 'EmployeeSalary',
      salaryEffectiveDate: salary.effectiveDate,
    }
  }
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { basicSalary: true, salaryEffectiveDate: true },
  })
  if (employee?.basicSalary && employee.salaryEffectiveDate && employee.salaryEffectiveDate <= periodEnd) {
    return {
      basicSalary: Number(employee.basicSalary),
      salarySource: 'Employee.basicSalary',
      salaryEffectiveDate: employee.salaryEffectiveDate,
    }
  }
  return { basicSalary: 0, salarySource: 'MISSING', salaryEffectiveDate: null }
}

export function calcProratedSalary(
  basicSalary: number,
  method: string,
  periodDays: number,
  eligibleDays: number,
): { prorated: number; warning?: string } {
  switch (method) {
    case 'NONE':
      return { prorated: basicSalary }
    case 'CALENDAR_DAYS':
      if (periodDays <= 0) return { prorated: basicSalary, warning: 'Invalid period days for proration' }
      return { prorated: roundMoney(money(basicSalary).mul(eligibleDays).div(periodDays)) }
    case 'WORKING_DAYS': {
      if (periodDays <= 0) return { prorated: basicSalary, warning: 'Invalid working days for proration' }
      return { prorated: roundMoney(money(basicSalary).mul(eligibleDays).div(periodDays)) }
    }
    case 'MANUAL':
      return { prorated: 0, warning: 'Manual proration requires accepted and locked input' }
    default:
      return { prorated: basicSalary, warning: `Unknown proration method: ${method}` }
  }
}

export async function resolveProrationPolicy(payrollPeriodId: string): Promise<string> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: payrollPeriodId },
    select: { prorationMethod: true },
  })
  return period?.prorationMethod || 'NONE'
}
