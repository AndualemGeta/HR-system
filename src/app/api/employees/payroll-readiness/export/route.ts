import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { getPayrollReadinessList } from '@/lib/payroll-readiness'
import Papa from 'papaparse'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.payrollReadiness.export'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId') || undefined
    const regionId = searchParams.get('regionId') || undefined
    const areaId = searchParams.get('areaId') || undefined
    const shopId = searchParams.get('shopId') || undefined
    const role = searchParams.get('role') || undefined
    const employmentStatus = searchParams.get('employmentStatus') || undefined
    const readinessStatus = searchParams.get('readinessStatus') || undefined

    const results = await getPayrollReadinessList({
      departmentId, regionId, areaId, shopId, role, employmentStatus, readinessStatus,
    })

    const csvData = results.map(r => ({
      'Employee ID': r.employeeId,
      'Full Name': r.fullName,
      'Role': r.role || '',
      'Department': r.department || '',
      'Shop': r.shop || '',
      'Category': r.employeeCategory || '',
      'Employment Status': r.employmentStatus || '',
      'Basic Salary Status': r.basicSalaryStatus,
      'Payment Info Status': r.paymentInfoStatus,
      'Tax Info Status': r.taxInfoStatus,
      'Pension Info Status': r.pensionInfoStatus,
      'Assignment Status': r.assignmentStatus,
      'Manager Status': r.managerStatus,
      'Readiness %': r.readinessPercentage,
      'Overall Status': r.overallStatus,
      'Blockers': r.blockers.join('; '),
      'Warnings': r.warnings.join('; '),
    }))

    const csv = Papa.unparse(csvData)

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_READINESS_EXPORT',
      entityType: 'PayrollReadiness',
      newValue: { rowCount: results.length, format: 'CSV' },
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll-readiness-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
