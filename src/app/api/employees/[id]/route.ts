import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { notFound, badRequest, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  hireDate: z.string().optional(),
  employmentType: z.string().optional(),
  employmentStatus: z.string().optional(),
  employeeCategory: z.string().optional(),
  currentRole: z.string().optional(),
  currentLevel: z.string().optional(),
  currentDepartmentId: z.string().optional(),
  currentDivisionId: z.string().optional(),
  currentRegionId: z.string().optional(),
  currentAreaId: z.string().optional(),
  currentShopId: z.string().optional(),
  currentClusterId: z.string().optional(),
  directManagerId: z.string().nullable().optional(),
  accountingReportingManagerId: z.string().nullable().optional(),
  basicSalary: z.number().optional(),
  salaryEffectiveDate: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        directManager: { select: { id: true, employeeId: true, fullName: true, currentRole: true } },
        accountingReportingManager: { select: { id: true, employeeId: true, fullName: true, currentRole: true } },
        assignments: { orderBy: { startDate: 'desc' }, take: 5 },
      },
    })
    if (!employee) return notFound()

    // Resolve location and department names
    let deptName: string | null = null
    let regionName: string | null = null
    let areaName: string | null = null
    let shopName: string | null = null
    if (employee.currentRegionId) {
      const loc = await prisma.location.findUnique({ where: { id: employee.currentRegionId }, select: { name: true } })
      regionName = loc?.name || null
    }
    if (employee.currentAreaId) {
      const loc = await prisma.location.findUnique({ where: { id: employee.currentAreaId }, select: { name: true } })
      areaName = loc?.name || null
    }
    if (employee.currentShopId) {
      const loc = await prisma.location.findUnique({ where: { id: employee.currentShopId }, select: { name: true } })
      shopName = loc?.name || null
    }
    if (employee.currentDepartmentId) {
      const dept = await prisma.department.findUnique({ where: { id: employee.currentDepartmentId }, select: { name: true } })
      deptName = dept?.name || null
    }

    const canViewSalary = await userHasPermission(session.userId, 'salary.view')

    const result: Record<string, unknown> = { ...employee }
    delete result.passwordHash
    // Add resolved location and department names
    result._regionName = regionName
    result._areaName = areaName
    result._shopName = shopName
    result._deptName = deptName

    if (!canViewSalary) {
      result.basicSalary = 'REDACTED'
      result.salaryEffectiveDate = 'REDACTED'
    }

    return success(result)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.update'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) return notFound()

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data

    // Block direct sensitive payroll field updates — must use change request approval
    if (data.basicSalary !== undefined || data.salaryEffectiveDate !== undefined) {
      return badRequest('Sensitive payroll fields must be changed through change request approval.')
    }

    const updateData: Record<string, unknown> = {}

    const stringFields = ['firstName', 'lastName', 'middleName', 'email', 'phoneNumber', 'gender', 'address', 'notes', 'employmentType', 'employmentStatus', 'employeeCategory', 'currentRole', 'currentLevel', 'currentDepartmentId', 'currentDivisionId', 'currentRegionId', 'currentAreaId', 'currentShopId', 'currentClusterId'] as const
    for (const field of stringFields) {
      if (data[field] !== undefined) {
        const val = data[field]
        // Convert empty strings to null for nullable fields; keep defaults for non-nullable
        if (val === '') {
          if (field === 'employmentType' || field === 'employeeCategory') {
            updateData[field] = null
          } else if (field === 'currentLevel') {
            updateData[field] = 'TO_BE_DEFINED'
          } else if (field === 'employmentStatus') {
            updateData[field] = 'DRAFT'
          } else if (field === 'currentRole') {
            updateData[field] = 'OTHER'
          } else {
            updateData[field] = val
          }
        } else {
          updateData[field] = val
        }
      }
    }
    if (data.directManagerId !== undefined) {
      const oldManagerId = existing.directManagerId
      updateData.directManagerId = data.directManagerId || null
      if (String(oldManagerId) !== String(updateData.directManagerId)) {
        await createAuditLog({
          userId: session.userId, action: 'MANAGER_CHANGE', entityType: 'Employee', entityId: id,
          oldValue: { directManagerId: oldManagerId }, newValue: { directManagerId: updateData.directManagerId },
        })
      }
    }
    if (data.accountingReportingManagerId !== undefined) {
      const oldAcctMgrId = existing.accountingReportingManagerId
      updateData.accountingReportingManagerId = data.accountingReportingManagerId || null
      if (String(oldAcctMgrId) !== String(updateData.accountingReportingManagerId)) {
        await createAuditLog({
          userId: session.userId, action: 'ACCOUNTING_MANAGER_CHANGE', entityType: 'Employee', entityId: id,
          oldValue: { accountingReportingManagerId: oldAcctMgrId }, newValue: { accountingReportingManagerId: updateData.accountingReportingManagerId },
        })
      }
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
    if (data.hireDate !== undefined) updateData.hireDate = data.hireDate ? new Date(data.hireDate) : null

    if (data.firstName !== undefined || data.lastName !== undefined || data.middleName !== undefined) {
      updateData.fullName = [data.firstName ?? existing.firstName, data.middleName ?? existing.middleName, data.lastName ?? existing.lastName].filter(Boolean).join(' ')
    }

    if (data.employmentStatus !== undefined && data.employmentStatus !== existing.employmentStatus) {
      await createAuditLog({
        userId: session.userId, action: 'EMPLOYEE_STATUS_CHANGE', entityType: 'Employee', entityId: id,
        oldValue: { employmentStatus: existing.employmentStatus }, newValue: { employmentStatus: data.employmentStatus },
      })
      await prisma.employeeStatusHistory.create({
        data: {
          employeeId: id, previousStatus: existing.employmentStatus,
          newStatus: data.employmentStatus as never, reason: 'Status updated via profile edit',
          effectiveDate: new Date(), updatedById: session.userId,
        },
      })
    }

    updateData.updatedById = session.userId

    const employee = await prisma.employee.update({ where: { id }, data: updateData })

    // Sync current assignment with updated role/level/location fields
    const assignFields = ['employeeCategory', 'currentRole', 'currentLevel', 'currentDepartmentId', 'currentDivisionId', 'currentRegionId', 'currentAreaId', 'currentShopId', 'currentClusterId', 'directManagerId', 'accountingReportingManagerId'] as const
    const assignMap: Record<string, string> = {
      currentRole: 'role', currentLevel: 'level', currentDepartmentId: 'departmentId',
      currentDivisionId: 'divisionId', currentRegionId: 'regionId', currentAreaId: 'areaId',
      currentShopId: 'shopId', currentClusterId: 'clusterId',
      directManagerId: 'directManagerId', accountingReportingManagerId: 'accountingReportingManagerId',
      employeeCategory: 'employeeCategory',
    }
    const changedAssignFields = assignFields.filter(f => data[f] !== undefined)
    if (changedAssignFields.length > 0) {
      const assignUpdate: Record<string, unknown> = {}
      for (const f of changedAssignFields) {
        const val = data[f]
        if (val === '' || val === null) {
          if (f === 'currentLevel') assignUpdate[assignMap[f]] = 'TO_BE_DEFINED'
          else if (f === 'currentRole') assignUpdate[assignMap[f]] = 'OTHER'
          else assignUpdate[assignMap[f]] = null
        } else {
          assignUpdate[assignMap[f]] = val
        }
      }
      await prisma.employeeAssignment.updateMany({
        where: { employeeId: id, isActive: true, endDate: null },
        data: assignUpdate,
      })
    }

    await createAuditLog({
      userId: session.userId, action: 'EMPLOYEE_UPDATE', entityType: 'Employee', entityId: id,
      oldValue: { fullName: existing.fullName }, newValue: { fullName: employee.fullName },
    })

    return success(employee)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
