import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import type { EmploymentStatus } from '@prisma/client'

const SNAPSHOT_STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_PROBATION']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status === 'LOCKED') return badRequest('Period is LOCKED. Reopen to DRAFT before snapshotting.')
    if (period.status !== 'DRAFT') return badRequest('Only draft periods can accept snapshots')

    const body = await req.json().catch(() => ({}))
    const confirm = body.confirm === true

    const existingCount = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id } })
    if (existingCount > 0) {
      if (!confirm) {
        return badRequest(
          'Rows already exist. Send { "confirm": true } to re-snapshot. ' +
          'WARNING: Re-snapshot will DELETE all existing rows and re-create them from active employees. ' +
          'All manually entered values (working days, commission, overtime, KPI, allowance, ' +
          'other deductions, notes) will be LOST.'
        )
      }
    }

    // Resolve names for location fields
    const [allDepts, allLocations] = await Promise.all([
      prisma.department.findMany(),
      prisma.location.findMany(),
    ])
    const deptMap = new Map(allDepts.map(d => [d.id, d.name]))
    const locMap = new Map(allLocations.map(l => [l.id, l.name]))

    function resolveEmployee(
      emp: {
        id: string
        employeeId: string
        fullName: string
        currentRole: string | null
        currentDepartmentId: string | null
        currentRegionId: string | null
        currentAreaId: string | null
        currentShopId: string | null
        basicSalary: import('@prisma/client').Prisma.Decimal | null
        salaryEffectiveDate: Date | null
        hireDate: Date | null
        payrollProfile: {
          paymentMethod: string | null
          bankName: string | null
          bankAccountNumber: string | null
          mpesaAccount: string | null
          taxId: string | null
          pensionId: string | null
          payrollGroup: import('@prisma/client').$Enums.PayrollGroup | null
        } | null
      },
      periodStart: Date
    ) {
      const deptName = emp.currentDepartmentId ? (deptMap.get(emp.currentDepartmentId) || null) : null
      const regionName = emp.currentRegionId ? (locMap.get(emp.currentRegionId) || null) : null
      const areaName = emp.currentAreaId ? (locMap.get(emp.currentAreaId) || null) : null
      const shopName = emp.currentShopId ? (locMap.get(emp.currentShopId) || null) : null
      const location = shopName || areaName || regionName

      const hireDate = emp.hireDate || null
      let pensionEligible = false
      if (hireDate) {
        const hireMonth = hireDate.getFullYear() * 12 + hireDate.getMonth()
        const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
        pensionEligible = payrollMonth >= hireMonth + 2
      }

      return {
        payrollPeriodId: id,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        role: emp.currentRole || null,
        department: deptName,
        region: regionName,
        area: areaName,
        shop: shopName,
        location,
        basicSalary: emp.basicSalary,
        workingDays: 30,
        payrollGroup: emp.payrollProfile?.payrollGroup || null,
        hireDate,
        salaryEffectiveDate: emp.salaryEffectiveDate || null,
        pensionEligible,
        paymentMethod: emp.payrollProfile?.paymentMethod || null,
        bankName: emp.payrollProfile?.bankName || null,
        bankAccountNumber: emp.payrollProfile?.bankAccountNumber || null,
        mpesaAccount: emp.payrollProfile?.mpesaAccount || null,
        taxId: emp.payrollProfile?.taxId || null,
        pensionId: emp.payrollProfile?.pensionId || null,
        snapshotJson: JSON.stringify({
          basicSalary: emp.basicSalary?.toString(),
          workingDays: 30,
          department: deptName,
          region: regionName,
          area: areaName,
          shop: shopName,
          location,
          payrollGroup: emp.payrollProfile?.payrollGroup,
          hireDate: hireDate?.toISOString(),
          salaryEffectiveDate: emp.salaryEffectiveDate?.toISOString(),
          pensionEligible,
          paymentMethod: emp.payrollProfile?.paymentMethod,
          bankName: emp.payrollProfile?.bankName,
          bankAccountNumber: emp.payrollProfile?.bankAccountNumber,
          mpesaAccount: emp.payrollProfile?.mpesaAccount,
          taxId: emp.payrollProfile?.taxId,
          pensionId: emp.payrollProfile?.pensionId,
        }),
      }
    }

    const employees = await prisma.employee.findMany({
      where: {
        employmentStatus: { in: SNAPSHOT_STATUSES },
      },
      include: { payrollProfile: true },
    })

    if (employees.length === 0) return badRequest('No eligible employees found')

    const periodStart = period.periodStart
    const rows = employees.map(emp => resolveEmployee(emp, periodStart))

    if (existingCount > 0) {
      // Re-snapshot: delete all existing rows and create new ones in a transaction.
      // If creation fails, the transaction rolls back and original rows are preserved.
      await prisma.$transaction(async (tx) => {
        await tx.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: id } })
        await tx.mvpPayrollRow.createMany({ data: rows })
      })

      await createAuditLog({
        userId: session.userId,
        action: 'PAYROLL_PERIOD_OPEN',
        entityType: 'MvpPayrollPeriod',
        entityId: id,
        newValue: { previousRowCount: existingCount, newRowCount: employees.length, reSnapshot: true },
      })
    } else {
      await prisma.mvpPayrollRow.createMany({ data: rows })

      await createAuditLog({
        userId: session.userId,
        action: 'PAYROLL_PERIOD_CREATE',
        entityType: 'MvpPayrollPeriod',
        entityId: id,
        newValue: { employeeCount: employees.length },
      })
    }

    return success({ employeeCount: employees.length })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}