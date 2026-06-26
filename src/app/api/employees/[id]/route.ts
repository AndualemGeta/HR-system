import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, badRequest, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  gender: z.string().optional(),
  employmentType: z.string().optional(),
  currentRole: z.string().optional(),
  currentLevel: z.string().optional(),
  currentDepartmentId: z.string().optional(),
  basicSalary: z.number().optional(),
})

async function getEmployeeOrNotFound(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return null
  return employee
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.view'))) return forbidden()

    const employee = await getEmployeeOrNotFound(id)
    if (!employee) return notFound()

    return success(employee)
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

    const existing = await getEmployeeOrNotFound(id)
    if (!existing) return notFound()

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.middleName !== undefined) updateData.middleName = data.middleName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType
    if (data.currentRole !== undefined) updateData.currentRole = data.currentRole
    if (data.currentLevel !== undefined) updateData.currentLevel = data.currentLevel
    if (data.currentDepartmentId !== undefined) updateData.currentDepartmentId = data.currentDepartmentId
    if (data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary

    if (data.firstName !== undefined || data.lastName !== undefined || data.middleName !== undefined) {
      updateData.fullName = [data.firstName ?? existing.firstName, data.middleName ?? existing.middleName, data.lastName ?? existing.lastName].filter(Boolean).join(' ')
    }

    updateData.updatedById = session.userId

    const employee = await prisma.employee.update({ where: { id }, data: updateData })

    await createAuditLog({
      userId: session.userId,
      action: 'EMPLOYEE_UPDATE',
      entityType: 'Employee',
      entityId: id,
      oldValue: { fullName: existing.fullName },
      newValue: { fullName: employee.fullName },
    })

    return success(employee)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
