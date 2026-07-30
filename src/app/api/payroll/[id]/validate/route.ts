import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { computePayroll } from '@/lib/payroll/mvp-calculations'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'DRAFT') return badRequest('Validation is only allowed in DRAFT status. Current status: ' + period.status)

    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id } })
    if (rows.length === 0) return badRequest('No rows to validate')

    // Fetch current employee profiles for fallback when row data is stale
    const empIds = rows.map(r => r.employeeId).filter(Boolean)
    const currentProfiles = await prisma.employeePayrollProfile.findMany({
      where: { employeeId: { in: empIds } },
    })
    const profileMap = new Map(currentProfiles.map(p => [p.employeeId, p]))

    const periodStart = period.periodStart

    const dupSet = new Set<string>()
    const dupCodes = new Set<string>()
    for (const row of rows) {
      if (dupSet.has(row.employeeCode)) dupCodes.add(row.employeeCode)
      dupSet.add(row.employeeCode)
    }

    const activeEmployeeCodes = await prisma.employee.findMany({
      where: { employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } },
      select: { employeeId: true, fullName: true },
    })
    const existingCodes = new Set(rows.map(r => r.employeeCode))
    const missingEmployees = activeEmployeeCodes.filter(e => !existingCodes.has(e.employeeId))

    const globalBlockers: string[] = []
    const globalWarnings: string[] = []
    const employeeMessages: Record<string, { employeeName: string; blockers: string[]; warnings: string[] }> = {}

    for (const dupCode of dupCodes) {
      globalBlockers.push(`Duplicate employee code: ${dupCode}`)
    }

    if (missingEmployees.length > 0) {
      globalBlockers.push(`Missing ${missingEmployees.length} active/on-probation employees (not snapshotted): ${missingEmployees.map(e => e.fullName).join(', ')}`)
    }

    for (const row of rows) {
      const msgs: string[] = []
      const warns: string[] = []
      const basic = Number(row.basicSalary || 0)
      const workingDays = Number(row.workingDays || 30)
      const monthlySalary = Number(row.monthlySalary || 0)
      const gross = Number(row.grossSalary || 0)
      const totalDed = Number(row.totalDeduction || 0)
      const net = Number(row.netSalary || 0)
      const commission = Number(row.commission || 0)
      const overtime = Number(row.overtime || 0)
      const incentive = Number(row.incentive || 0)
      const allowance = Number(row.allowance || 0)
      const shortageLoan = Number(row.otherDeduction || 0)

      if (!row.employeeCode) msgs.push('Missing employee code')
      if (!row.employeeName) msgs.push('Missing employee name')

      const liveProfile = profileMap.get(row.employeeId)
      const livePayrollGroup = liveProfile?.payrollGroup || null
      if (!row.payrollGroup && !livePayrollGroup) msgs.push('MISSING_PAYROLL_GROUP: Employee has no assigned payroll group')

      if (!row.hireDate) msgs.push('MISSING_PENSION_ELIGIBILITY_DATE: No hire/registration date for employee')
      if (basic <= 0) msgs.push('Basic salary must be greater than zero')
      if (workingDays <= 0 || workingDays > 31) msgs.push('Working days must be between 1 and 31')
      if (monthlySalary <= 0) msgs.push('Monthly salary not calculated or zero — run Calculate')
      if (gross <= 0) msgs.push('Gross salary not calculated or zero — run Calculate')
      if (Number(row.incomeTax) < 0) msgs.push('Income tax cannot be negative')
      if (!row.snapshotJson) msgs.push('Missing snapshot data — run Snapshot first')

      let pm = row.paymentMethod || liveProfile?.paymentMethod || null
      if (pm === 'BANK_TRANSFER') pm = 'BANK'
      else if (pm === 'MOBILE_MONEY') pm = 'MPESA'
      if (!pm) warns.push('No payment method set — will default to HOLD')
      else if (pm === 'BANK') {
        const bankName = row.bankName || liveProfile?.bankName || null
        const bankAccountNumber = row.bankAccountNumber || liveProfile?.bankAccountNumber || null
        if (!bankName) warns.push('BANK payment selected but bank name is missing')
        if (!bankAccountNumber) warns.push('BANK payment selected but bank account number is missing')
      } else if (pm === 'MPESA') {
        const mpesa = row.mpesaAccount || liveProfile?.mpesaAccount || null
        if (!mpesa) warns.push('MPESA payment selected but M-PESA account is missing')
      } else if (pm === 'MANUAL' || pm === 'CASH') {
        // MANUAL/CASH — no account warning
      } else if (pm === 'HOLD') {
        warns.push('HOLD payment selected — salary will be held and not disbursed')
      } else {
        warns.push(`Unknown payment method: ${pm}`)
      }

      const taxId = row.taxId || (() => {
        try {
          const snap = typeof row.snapshotJson === 'string' ? JSON.parse(row.snapshotJson) : row.snapshotJson
          return snap?.taxId || null
        } catch { return null }
      })() || liveProfile?.taxId || null
      if (!taxId) warns.push('No tax ID on file for employee')

      const pensionId = row.pensionId || (() => {
        try {
          const snap = typeof row.snapshotJson === 'string' ? JSON.parse(row.snapshotJson) : row.snapshotJson
          return snap?.pensionId || null
        } catch { return null }
      })() || liveProfile?.pensionId || null
      if (!pensionId) {
        if (row.pensionEligible === true) {
          warns.push('Pension ID is required — employee is eligible for pension')
        } else {
          const hireMonth = row.hireDate
            ? row.hireDate.getFullYear() * 12 + row.hireDate.getMonth()
            : null
          const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
          if (hireMonth !== null && payrollMonth < hireMonth + 2) {
            warns.push('Pension ID not yet required — within first two payroll months')
          } else {
            warns.push('No pension ID on file for employee')
          }
        }
      }

      // Warn for on-leave or suspended employees
      try {
        const snap = typeof row.snapshotJson === 'string' ? JSON.parse(row.snapshotJson) : row.snapshotJson
        if (snap?.employmentStatus === 'ON_LEAVE') warns.push('Employee currently on leave — review KPI and allowance values')
        else if (snap?.employmentStatus === 'SUSPENDED') warns.push('Employee currently suspended — review KPI and allowance values')
      } catch {}

      const expected = computePayroll({
        basicSalary: basic, workingDays, commission, overtime,
        incentive, allowance, otherDeduction: shortageLoan,
        pensionEligible: row.pensionEligible === true,
        isNetIncentive: true,
      })

      if (monthlySalary > 0 && Math.abs(monthlySalary - expected.monthlySalary) > 1) {
        msgs.push(`Monthly salary (${monthlySalary}) differs from expected (${expected.monthlySalary}) — recalculate`)
      }
      if (gross > 0 && Math.abs(gross - expected.grossSalary) > 1) {
        msgs.push(`Gross salary (${gross}) differs from expected (${expected.grossSalary}) — recalculate`)
      }
      if (totalDed > 0 && Math.abs(totalDed - expected.totalDeduction) > 1) {
        msgs.push(`Total deduction (${totalDed}) differs from expected (${expected.totalDeduction}) — recalculate`)
      }
      if (net > 0 && Math.abs(net - expected.netSalary) > 1) {
        msgs.push(`Net salary (${net}) differs from expected (${expected.netSalary}) — recalculate`)
      }

      if (msgs.length > 0 || warns.length > 0) {
        employeeMessages[row.id] = { employeeName: row.employeeName, blockers: msgs, warnings: warns }
        globalBlockers.push(...msgs)
        globalWarnings.push(...warns)
      }

      const status = msgs.length > 0 ? 'ERROR' : warns.length > 0 ? 'WARNING' : 'VALID'
      await prisma.mvpPayrollRow.update({
        where: { id: row.id },
        data: { validationStatus: status, validationMessages: JSON.stringify([...msgs, ...warns]) },
      })
    }

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_VALIDATE', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { blockerCount: globalBlockers.length, warningCount: globalWarnings.length },
    })

    const updatedRows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id },
      orderBy: { employeeName: 'asc' },
    })

    return success({
      blockers: [...new Set(globalBlockers)],
      warnings: [...new Set(globalWarnings)],
      blockerCount: globalBlockers.length,
      warningCount: globalWarnings.length,
      employees: employeeMessages,
      rows: updatedRows,
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
