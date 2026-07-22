import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'statutoryReport.generate'))) return forbidden()
    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id }, include: { payslipSnapshots: true } })
    if (!pkg) return notFound()
    const body = await req.json().catch(() => ({}))
    const reportType = body.reportType as string
    if (!['PAYE', 'EMPLOYEE_PENSION', 'EMPLOYER_PENSION', 'COMBINED_PENSION'].includes(reportType)) return badRequest('Invalid reportType')

    const employees = pkg.payslipSnapshots.map(s => ({
      code: s.employeeCode,
      name: s.fullName,
      taxableIncome: Number(s.grossSalary) || 0,
      payeTax: 0,
      employeePension: 0,
      employerPension: 0,
    }))

    let employeeAmount = 0, employerAmount = 0
    if (reportType === 'PAYE' || reportType === 'COMBINED_PENSION') {
      employeeAmount = Number(pkg.payeTaxTotal) || 0
    }
    if (reportType === 'EMPLOYEE_PENSION' || reportType === 'COMBINED_PENSION') {
      employeeAmount = Number(pkg.employeePensionTotal) || 0
      employerAmount = Number(pkg.employerPensionTotal) || 0
    }
    if (reportType === 'EMPLOYER_PENSION') {
      employerAmount = Number(pkg.employerPensionTotal) || 0
    }

    const report = await prisma.payrollStatutoryReport.create({
      data: {
        outputPackageId: id,
        reportType: reportType as 'PAYE' | 'EMPLOYEE_PENSION' | 'EMPLOYER_PENSION' | 'COMBINED_PENSION',
        status: 'DRAFT',
        employeeCount: employees.length,
        employeeAmount,
        employerAmount,
        totalAmount: employeeAmount + employerAmount,
        generatedById: session.userId,
      },
    })
    await createAuditLog({ userId: session.userId, action: 'STATUTORY_REPORT_GENERATE' as never, entityType: 'PayrollStatutoryReport', entityId: report.id, newValue: { reportType } })
    return success(report)
  } catch (e) { console.error(e); return internalError() }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'statutoryReport.view'))) return forbidden()
    const { id } = await params
    const reports = await prisma.payrollStatutoryReport.findMany({ where: { outputPackageId: id }, orderBy: { generatedAt: 'desc' } })
    return success(reports)
  } catch (e) { console.error(e); return internalError() }
}
