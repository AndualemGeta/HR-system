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

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'DRAFT') return badRequest('Only draft periods can accept snapshots')

    // Check if rows already exist
    const existingCount = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id } })
    if (existingCount > 0) return badRequest('Rows already exist. Remove them first to re-snapshot.')

    // Get active employees
    const employees = await prisma.employee.findMany({
      where: {
        employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] },
      },
      include: {
        payrollProfile: true,
      },
    })

    if (employees.length === 0) return badRequest('No active employees found')

    const periodStart = period.periodStart // start of payroll month

    function computePensionEligible(hireDate: Date | null): { eligible: boolean; snapshotDate: Date | null } {
      if (!hireDate) return { eligible: false, snapshotDate: null }
      // Registration month = month of hireDate
      // Pension starts in the 3rd payroll month after hireDate
      const hireMonth = hireDate.getFullYear() * 12 + hireDate.getMonth()
      const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
      const eligible = payrollMonth >= hireMonth + 2
      return { eligible, snapshotDate: hireDate }
    }

    const rows = employees.map(emp => {
      const { eligible, snapshotDate } = computePensionEligible(emp.hireDate)
      return {
        payrollPeriodId: id,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        department: null,
        role: emp.currentRole || null,
        location: emp.currentShopId || emp.currentRegionId || null,
        basicSalary: emp.basicSalary,
        workingDays: 30,
        hireDate: snapshotDate,
        pensionEligible: eligible,
        paymentMethod: emp.payrollProfile?.paymentMethod || null,
        bankName: emp.payrollProfile?.bankName || null,
        bankAccountNumber: emp.payrollProfile?.bankAccountNumber || null,
        mpesaAccount: emp.payrollProfile?.mpesaAccount || null,
        snapshotJson: JSON.stringify({
          basicSalary: emp.basicSalary?.toString(),
          workingDays: 30,
          hireDate: snapshotDate?.toISOString(),
          pensionEligible: eligible,
          paymentMethod: emp.payrollProfile?.paymentMethod,
          bankName: emp.payrollProfile?.bankName,
          bankAccountNumber: emp.payrollProfile?.bankAccountNumber,
          mpesaAccount: emp.payrollProfile?.mpesaAccount,
          taxId: emp.payrollProfile?.taxId,
          pensionId: emp.payrollProfile?.pensionId,
        }),
      }
    })

    await prisma.mvpPayrollRow.createMany({ data: rows })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PERIOD_OPEN',
      entityType: 'MvpPayrollPeriod',
      entityId: id,
      newValue: { employeeCount: employees.length },
    })

    return success({ employeeCount: employees.length })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
