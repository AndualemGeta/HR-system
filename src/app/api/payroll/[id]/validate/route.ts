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

      if (!row.employeeCode) msgs.push('Missing employee code')
      if (!row.employeeName) msgs.push('Missing employee name')
      if (row.basicSalary == null || Number(row.basicSalary) < 0) msgs.push('Invalid basic salary')
      if (row.grossSalary == null || Number(row.grossSalary) < 0) msgs.push('Gross salary not calculated')
      if (row.netSalary == null || Number(row.netSalary) < 0) msgs.push('Net salary not calculated')
      if (row.paymentMethod === 'BANK' && !row.bankAccountNumber) msgs.push('Bank account required for BANK payment')
      if (row.paymentMethod === 'MPESA' && !row.mpesaAccount) msgs.push('M-PESA number required for MPESA payment')
      if (row.employeePension != null && Number(row.employeePension) < 0) warns.push('Negative pension value')

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

    // Recalculate rows to get updated validation statuses
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
