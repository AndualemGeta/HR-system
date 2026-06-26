import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { badRequest, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  employeeId: z.string(),
  basicSalary: z.number().positive(),
  effectiveDate: z.string(),
  reason: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId') || ''

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId

    const salaries = await prisma.employeeSalary.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeId: true, fullName: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    })

    return success(salaries)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.update'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data

    const salary = await prisma.employeeSalary.create({
      data: {
        employeeId: data.employeeId,
        basicSalary: data.basicSalary,
        effectiveDate: new Date(data.effectiveDate),
        reason: data.reason,
        createdById: session.userId,
      },
    })

    await prisma.employee.update({
      where: { id: data.employeeId },
      data: { basicSalary: data.basicSalary, salaryEffectiveDate: new Date(data.effectiveDate) },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SALARY_CHANGE',
      entityType: 'Employee',
      entityId: data.employeeId,
      newValue: { basicSalary: data.basicSalary },
    })

    return success(salary, 201)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
