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

    // Re-validate ERROR rows against live profiles (profile fix may have cleared the blocker)
    const errorRows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id, validationStatus: 'ERROR' } })
    if (errorRows.length > 0) {
      const empIds = errorRows.map(r => r.employeeId).filter(Boolean)
      const profiles = await prisma.employeePayrollProfile.findMany({ where: { employeeId: { in: empIds } } })
      const profileMap = new Map(profiles.map(p => [p.employeeId, p]))
      const employees = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, hireDate: true } })
      const empMap = new Map(employees.map(e => [e.id, e]))
      const stillBlocked: string[] = []
      for (const row of errorRows) {
        const live = profileMap.get(row.employeeId)
        const emp = empMap.get(row.employeeId)
        const msgs = JSON.parse(typeof row.validationMessages === 'string' ? row.validationMessages : '[]') as string[]
        const remaining = msgs.filter(m => {
          if (m === 'MISSING_PAYROLL_GROUP: Employee has no assigned payroll group' && live?.payrollGroup) return false
          if (m.startsWith('Pension ID is required')) return false
          if (m === 'MISSING_PENSION_ELIGIBILITY_DATE: No hire/registration date for employee' && emp?.hireDate) return false
          return true
        })
        if (remaining.length > 0) stillBlocked.push(`${row.employeeName} (${row.employeeCode})`)
      }
      if (stillBlocked.length > 0) {
        return badRequest(`Cannot mark READY: ${stillBlocked.length} row(s) still have blockers: ${stillBlocked.join(', ')}. Run validation first.`)
      }
    }

    // All rows must have a payroll group (check live profile as fallback)
    const rowsWithoutGroup = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id, payrollGroup: null },
      select: { id: true, employeeId: true, employeeName: true, employeeCode: true },
    })
    if (rowsWithoutGroup.length > 0) {
      const empIds = rowsWithoutGroup.map(r => r.employeeId).filter(Boolean)
      const profiles = await prisma.employeePayrollProfile.findMany({ where: { employeeId: { in: empIds } } })
      const profileMap = new Map(profiles.map(p => [p.employeeId, p]))
      const stillMissing = rowsWithoutGroup.filter(r => !profileMap.get(r.employeeId)?.payrollGroup)
      if (stillMissing.length > 0) {
        return badRequest(
          `Cannot mark READY: ${stillMissing.length} employee(s) missing payroll group. ` +
          `Missing: ${stillMissing.map(e => e.employeeName).join(', ')}. Assign groups and validate first.`
        )
      }
    }

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
