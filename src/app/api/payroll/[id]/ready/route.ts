import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({
      where: { id },
      include: { _count: { select: { rows: true } } },
    })
    if (!period) return notFound()
    if (period.status !== 'DRAFT') return badRequest('Period must be in DRAFT status')

    const rowCount = period._count.rows
    if (rowCount === 0) return badRequest('No employee rows to prepare. Run snapshot first.')

    // All rows must be calculated
    const uncalculatedRows = await prisma.mvpPayrollRow.count({
      where: { payrollPeriodId: id, monthlySalary: { lte: 0 } },
    })
    if (uncalculatedRows > 0) return badRequest(`Cannot mark READY: ${uncalculatedRows} row(s) have zero monthly salary. Run Calculate first.`)

    // No PENDING rows
    const pendingRows = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, validationStatus: 'PENDING' } })
    if (pendingRows > 0) return badRequest(`Cannot mark READY: ${pendingRows} row(s) have not been validated. Run validation first.`)

    // No ERROR rows
    const errorRows = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, validationStatus: 'ERROR' } })
    if (errorRows > 0) return badRequest(`Cannot mark READY: ${errorRows} row(s) have validation errors. Fix blockers first.`)

    // All rows must have a payroll group
    const missingGroup = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, payrollGroup: null } })
    if (missingGroup > 0) return badRequest(`Cannot mark READY: ${missingGroup} employee(s) missing payroll group. Assign groups and run validation first.`)

    // No missing active/probation employees (not snapshotted)
    const existingCodes = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id },
      select: { employeeCode: true },
    })
    const existingCodeSet = new Set(existingCodes.map(r => r.employeeCode))
    const missingActiveEmployees = await prisma.employee.findMany({
      where: {
        employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] },
        employeeId: { notIn: [...existingCodeSet] },
      },
      select: { employeeId: true, fullName: true },
    })
    if (missingActiveEmployees.length > 0) {
      return badRequest(
        `Cannot mark READY: ${missingActiveEmployees.length} active employee(s) not found in payroll rows. ` +
        `Missing: ${missingActiveEmployees.map(e => e.fullName).join(', ')}. Run Snapshot first.`
      )
    }

    const updated = await prisma.mvpPayrollPeriod.update({
      where: { id },
      data: { status: 'READY', readyById: session.userId, readyAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_PERIOD_READY', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { status: 'READY' },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
