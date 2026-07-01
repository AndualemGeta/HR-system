import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true } })
    if (!period) return notFound('Payroll period not found')

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)

    const [selectedRecords, activeInputTypes] = await Promise.all([
      prisma.payrollPeriodEmployee.findMany({
        where: { payrollPeriodId: id, isSelected: true },
        select: { employeeId: true },
      }),
      prisma.payrollInputType.count({ where: { isActive: true } }),
    ])

    const scopeEmployeeIds = selectedRecords.map(e => e.employeeId)

    let filteredEmployeeIds = scopeEmployeeIds
    if (Object.keys(scopeWhere).length > 0) {
      const employees = await prisma.employee.findMany({
        where: { ...scopeWhere, id: { in: scopeEmployeeIds } },
        select: { id: true },
      })
      const allowed = new Set(employees.map(e => e.id))
      filteredEmployeeIds = scopeEmployeeIds.filter(eid => allowed.has(eid))
    }

    const totalSelectedEmployees = filteredEmployeeIds.length

    const inputsWhere = {
      payrollPeriodId: id,
      ...(filteredEmployeeIds.length > 0 ? { employeeId: { in: filteredEmployeeIds } } : {}),
    }

    const [totalInputRecords, draftInputs, submittedInputs, acceptedInputs, rejectedInputs, returnedInputs, recentSubmissions, rejectedReturned] = await Promise.all([
      prisma.payrollInput.count({ where: inputsWhere }),
      prisma.payrollInput.count({ where: { ...inputsWhere, status: 'DRAFT' } }),
      prisma.payrollInput.count({ where: { ...inputsWhere, status: 'SUBMITTED' } }),
      prisma.payrollInput.count({ where: { ...inputsWhere, status: 'ACCEPTED' } }),
      prisma.payrollInput.count({ where: { ...inputsWhere, status: 'REJECTED' } }),
      prisma.payrollInput.count({ where: { ...inputsWhere, status: 'RETURNED' } }),
      prisma.payrollInput.findMany({
        where: { ...inputsWhere, status: 'SUBMITTED' },
        include: {
          employee: { select: { id: true, employeeId: true, fullName: true } },
          inputType: { select: { id: true, code: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.payrollInput.findMany({
        where: { ...inputsWhere, status: { in: ['REJECTED', 'RETURNED'] } },
        include: {
          employee: { select: { id: true, employeeId: true, fullName: true } },
          inputType: { select: { id: true, code: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ])

    const missingInputs = totalSelectedEmployees * activeInputTypes - totalInputRecords

    const empDeptRecords = await prisma.employee.findMany({
      where: { id: { in: filteredEmployeeIds }, currentDepartmentId: { not: null } },
      select: { id: true, currentDepartmentId: true },
    })

    const deptIds = [...new Set(empDeptRecords.map(e => e.currentDepartmentId).filter(Boolean))] as string[]
    const departments = await prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    })
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))

    const departmentsSubmitted: Array<{ departmentId: string; departmentName: string; submittedCount: number; totalCount: number }> = []
    for (const deptId of deptIds) {
      const empIdsInDept = empDeptRecords.filter(e => e.currentDepartmentId === deptId).map(e => e.id)
      const totalCount = empIdsInDept.length
      const submittedCount = await prisma.payrollInput.count({
        where: { payrollPeriodId: id, employeeId: { in: empIdsInDept }, status: 'SUBMITTED' },
      })
      departmentsSubmitted.push({
        departmentId: deptId,
        departmentName: deptMap[deptId] ?? 'Unknown',
        submittedCount,
        totalCount,
      })
    }

    const empShopRecords = await prisma.employee.findMany({
      where: { id: { in: filteredEmployeeIds }, currentShopId: { not: null } },
      select: { id: true, currentShopId: true },
    })

    const shopIds = [...new Set(empShopRecords.map(e => e.currentShopId).filter(Boolean))] as string[]
    const shops = await prisma.location.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true },
    })
    const shopMap = Object.fromEntries(shops.map(s => [s.id, s.name]))

    const shopsSubmitted: Array<{ shopId: string; shopName: string; submittedCount: number; totalCount: number }> = []
    for (const shopId of shopIds) {
      const empIdsInShop = empShopRecords.filter(e => e.currentShopId === shopId).map(e => e.id)
      const totalCount = empIdsInShop.length
      const submittedCount = await prisma.payrollInput.count({
        where: { payrollPeriodId: id, employeeId: { in: empIdsInShop }, status: 'SUBMITTED' },
      })
      shopsSubmitted.push({
        shopId,
        shopName: shopMap[shopId] ?? 'Unknown',
        submittedCount,
        totalCount,
      })
    }

    return success({
      totalSelectedEmployees,
      totalInputRecords,
      draftInputs,
      submittedInputs,
      acceptedInputs,
      rejectedInputs,
      returnedInputs,
      missingInputs: Math.max(0, missingInputs),
      departmentsSubmitted,
      shopsSubmitted,
      recentSubmissions,
      rejectedReturned,
    })
  } catch (err) { console.error(err); return internalError() }
}
