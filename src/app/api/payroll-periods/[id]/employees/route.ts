import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { assertEmployeesInUserScope } from '@/lib/payroll-scope'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true } })
    if (!period) return notFound('Payroll period not found')

    const { searchParams } = new URL(req.url)
    const isSelected = searchParams.get('isSelected')
    const scopeWhere = await buildEmployeeScopeWhere(session.userId)

    const records = await prisma.payrollPeriodEmployee.findMany({
      where: {
        payrollPeriodId: id,
        ...(isSelected !== null ? { isSelected: isSelected === 'true' } : {}),
        ...(Object.keys(scopeWhere).length > 0 ? { employee: scopeWhere } : {}),
      },
      include: {
        employee: {
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
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    })

    return success(records)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'DRAFT' && period.status !== 'OPEN_FOR_INPUT') return badRequest('Period must be DRAFT or OPEN_FOR_INPUT to add employees')

    const body = await req.json().catch(() => ({}))
    const { employeeIds } = body
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) return badRequest('employeeIds is required and must be a non-empty array')

    const scopeCheck = await assertEmployeesInUserScope(session.userId, employeeIds)
    if (!scopeCheck.allowed) return forbidden(scopeCheck.error)

    const existing = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, employeeId: { in: employeeIds } },
      select: { employeeId: true },
    })
    const existingSet = new Set(existing.map(e => e.employeeId))

    for (const empId of employeeIds) {
      await prisma.payrollPeriodEmployee.upsert({
        where: { payrollPeriodId_employeeId: { payrollPeriodId: id, employeeId: empId } },
        update: { isSelected: true, removedAt: null, removedById: null },
        create: { payrollPeriodId: id, employeeId: empId, addedById: session.userId },
      })
    }

    const added = employeeIds.filter(eid => !existingSet.has(eid))
    const reactivated = employeeIds.filter(eid => existingSet.has(eid))

    if (added.length > 0 || reactivated.length > 0) {
      await createAuditLog({
        userId: session.userId,
        action: 'PAYROLL_EMPLOYEE_ADD',
        entityType: 'PayrollPeriod',
        entityId: id,
        newValue: { added: added.length, reactivated: reactivated.length, employeeIds },
      })
    }

    const updatedRecords = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, employeeId: { in: employeeIds } },
      include: { employee: { select: { id: true, employeeId: true, fullName: true } } },
    })

    return success(updatedRecords, 201)
  } catch (err) { console.error(err); return internalError() }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'DRAFT') return badRequest('Employees can only be removed from DRAFT periods')

    const body = await req.json().catch(() => ({}))
    const { employeeIds } = body
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) return badRequest('employeeIds is required and must be a non-empty array')

    const scopeCheck = await assertEmployeesInUserScope(session.userId, employeeIds)
    if (!scopeCheck.allowed) return forbidden(scopeCheck.error)

    await prisma.payrollPeriodEmployee.updateMany({
      where: { payrollPeriodId: id, employeeId: { in: employeeIds } },
      data: { isSelected: false, removedAt: new Date(), removedById: session.userId },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_EMPLOYEE_REMOVE',
      entityType: 'PayrollPeriod',
      entityId: id,
      newValue: { removed: employeeIds.length, employeeIds },
    })

    return success({ removed: employeeIds.length })
  } catch (err) { console.error(err); return internalError() }
}
