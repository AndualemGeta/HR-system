import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollJournal.view'))) return forbidden()
    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({
      where: { id },
      include: { payslipSnapshots: true },
    })
    if (!pkg) return notFound()
    const csv = 'Employee Code,Full Name,Gross Salary,Total Deductions,Net Salary,Employer Cost\n'
      + pkg.payslipSnapshots.map(s => `${s.employeeCode},${s.fullName},${Number(s.grossSalary).toFixed(2)},${Number(s.totalDeductions).toFixed(2)},${Number(s.netSalary).toFixed(2)},0.00`).join('\n')
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payroll-register-${id.slice(0, 8)}.csv"` } })
  } catch (e) { console.error(e); return internalError() }
}
