import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'statutoryReport.export'))) return forbidden()
    const { id } = await params
    const report = await prisma.payrollStatutoryReport.findUnique({
      where: { id },
      include: { outputPackage: { include: { payslipSnapshots: true } } },
    })
    if (!report) return notFound()
    const csv = ['Employee Code,Full Name,Taxable Income,Amount']
      + '\n' + report.outputPackage.payslipSnapshots.map(s =>
        `${s.employeeCode},${s.fullName},${Number(s.grossSalary).toFixed(2)},${(report.reportType === 'PAYE' ? Number(report.employeeAmount) / Math.max(report.employeeCount, 1) : 0).toFixed(2)}`
      ).join('\n')
    await createAuditLog({ userId: session.userId, action: 'STATUTORY_REPORT_DOWNLOAD' as never, entityType: 'PayrollStatutoryReport', entityId: id })
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="statutory-report-${report.reportType}-${id.slice(0, 8)}.csv"` } })
  } catch (e) { console.error(e); return internalError() }
}
