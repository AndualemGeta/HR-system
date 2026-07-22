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

    const blockers: string[] = []
    const warnings: string[] = []
    const employeeMessages: Record<string, { employeeName: string; blockers: string[]; warnings: string[] }> = {}

    for (const row of rows) {
      const msgs: string[] = []
      const warns: string[] = []
      const basic = Number(row.basicSalary || 0)
      const workingDays = Number(row.workingDays || 30)

      if (!row.employeeCode) msgs.push('Missing employee code')
      if (!row.employeeName) msgs.push('Missing employee name')
      if (basic <= 0) msgs.push('Basic salary must be greater than zero')
      if (workingDays <= 0 || workingDays > 31) msgs.push('Working days must be between 1 and 31')
      if (!row.hireDate) msgs.push('MISSING_PENSION_ELIGIBILITY_DATE: No hire/registration date for employee')
      if (Number(row.grossSalary) <= 0) msgs.push('Gross salary not calculated or zero')
      if (Number(row.netSalary) <= 0) warns.push('Net salary is zero or negative')
      if (Number(row.incomeTax) < 0) msgs.push('Income tax cannot be negative')
      if (Number(row.employeePension) < 0) warns.push('Employee pension is negative')
      if (Number(row.otherDeduction) < 0) warns.push('Shortage/loan deduction is negative')

      // Check basic arithmetic
      const monthlyCalc = Math.round((basic / 30) * workingDays * 100) / 100
      const monthlySalary = Number(row.monthlySalary || 0)
      if (monthlySalary > 0 && Math.abs(monthlySalary - monthlyCalc) > 1) {
        warns.push(`Monthly salary (${monthlySalary}) differs from Basic/30×Days (${monthlyCalc})`)
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
