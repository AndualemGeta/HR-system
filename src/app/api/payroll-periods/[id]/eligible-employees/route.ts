import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { getPayrollReadiness } from '@/lib/payroll-readiness'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true, periodStart: true, periodEnd: true } })
    if (!period) return notFound('Payroll period not found')

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId')
    const regionId = searchParams.get('regionId')
    const areaId = searchParams.get('areaId')
    const shopId = searchParams.get('shopId')
    const role = searchParams.get('role')
    const employmentStatus = searchParams.get('employmentStatus')
    const search = searchParams.get('search')

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)

    const excludedStatuses = ['TERMINATED', 'RESIGNED', 'EXITED', 'INACTIVE', 'DRAFT']

    const where: Record<string, unknown> = {
      ...scopeWhere,
      employmentStatus: { notIn: excludedStatuses },
    }

    if (employmentStatus) where.employmentStatus = employmentStatus
    if (departmentId) where.currentDepartmentId = departmentId
    if (regionId) where.currentRegionId = regionId
    if (areaId) where.currentAreaId = areaId
    if (shopId) where.currentShopId = shopId
    if (role) where.currentRole = role

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        firstName: true,
        lastName: true,
        currentRole: true,
        currentLevel: true,
        currentDepartmentId: true,
        currentRegionId: true,
        currentAreaId: true,
        currentShopId: true,
        employmentStatus: true,
        employmentType: true,
        employeeCategory: true,
        basicSalary: true,
        hireDate: true,
      },
      orderBy: { fullName: 'asc' },
    })

    const selectedIds = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true },
      select: { employeeId: true },
    })
    const selectedSet = new Set(selectedIds.map(s => s.employeeId))

    const readinessResults = await Promise.allSettled(
      employees.map(emp => getPayrollReadiness(emp.id))
    )
    const readinessMap = new Map<string, unknown>()
    for (let i = 0; i < employees.length; i++) {
      const r = readinessResults[i]
      if (r.status === 'fulfilled' && r.value) readinessMap.set(employees[i].id, r.value)
    }

    const result = employees.map(emp => ({
      ...emp,
      basicSalary: emp.basicSalary?.toString() ?? null,
      isSelected: selectedSet.has(emp.id),
      payrollReadiness: readinessMap.get(emp.id) || null,
    }))

    return success(result)
  } catch (err) { console.error(err); return internalError() }
}
