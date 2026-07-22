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

    // Parse body for re-snapshot confirmation
    const body = await req.json().catch(() => ({}))
    const confirm = body.confirm === true

    // Check if rows already exist
    const existingCount = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id } })
    if (existingCount > 0) {
      if (!confirm) return badRequest('Rows already exist. Send { "confirm": true } to re-snapshot (existing rows will be deleted and re-created).')
      // Delete existing rows for re-snapshot
      await prisma.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: id } })
    }

    // Resolve department, region, area, shop names for correct worksheet assignment
    const [allDepts, allLocations] = await Promise.all([
      prisma.department.findMany(),
      prisma.location.findMany(),
    ])
    const deptMap = new Map(allDepts.map(d => [d.id, d.name]))
    const locMap = new Map(allLocations.map(l => [l.id, l.name]))

    function resolveLocation(emp: typeof employees[0]): { department: string | null; location: string | null } {
      const deptName = emp.currentDepartmentId ? (deptMap.get(emp.currentDepartmentId) || null) : null
      // Build location string: prefer Shop > Area > Region
      const shopName = emp.currentShopId ? (locMap.get(emp.currentShopId) || null) : null
      const areaName = emp.currentAreaId ? (locMap.get(emp.currentAreaId) || null) : null
      const regionName = emp.currentRegionId ? (locMap.get(emp.currentRegionId) || null) : null
      const location = shopName || areaName || regionName
      return { department: deptName, location }
    }

    const [activeEmployees, onProbationEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: { employmentStatus: 'ACTIVE' },
        include: { payrollProfile: true },
      }),
      prisma.employee.findMany({
        where: { employmentStatus: 'ON_PROBATION' },
        include: { payrollProfile: true },
      }),
    ])
    const employees = [...activeEmployees, ...onProbationEmployees]

    if (employees.length === 0) return badRequest('No active employees found')

    const periodStart = period.periodStart // start of payroll month

    function computePensionEligible(hireDate: Date | null): { eligible: boolean; snapshotDate: Date | null } {
      if (!hireDate) return { eligible: false, snapshotDate: null }
      const hireMonth = hireDate.getFullYear() * 12 + hireDate.getMonth()
      const payrollMonth = periodStart.getFullYear() * 12 + periodStart.getMonth()
      const eligible = payrollMonth >= hireMonth + 2
      return { eligible, snapshotDate: hireDate }
    }

    const rows = employees.map(emp => {
      const { eligible, snapshotDate } = computePensionEligible(emp.hireDate)
      const { department, location } = resolveLocation(emp)
      return {
        payrollPeriodId: id,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        department,
        role: emp.currentRole || null,
        location,
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
          department,
          location,
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
