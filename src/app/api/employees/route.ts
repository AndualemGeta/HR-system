import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth, badRequest, success } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { PAGINATION_DEFAULT_PAGE, PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, EMPLOYEE_ID_PREFIX } from '@/lib/constants'

const createSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  gender: z.string().optional(),
  employmentType: z.string().optional(),
  currentRole: z.string().optional(),
  currentLevel: z.string().optional(),
  currentDepartmentId: z.string().optional(),
})

async function getNextEmployeeId(): Promise<string> {
  const last = await prisma.employee.findFirst({
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  })
  if (!last) return `${EMPLOYEE_ID_PREFIX}_0001`
  const num = parseInt(last.employeeId.split('_')[1], 10)
  return `${EMPLOYEE_ID_PREFIX}_${String(num + 1).padStart(4, '0')}`
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || String(PAGINATION_DEFAULT_PAGE)))
  const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULT_LIMIT))))
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const departmentId = searchParams.get('departmentId') || ''

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status) where.employmentStatus = status
  if (departmentId) where.currentDepartmentId = departmentId

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { employeeId: 'asc' },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        currentRole: true,
        currentLevel: true,
        employmentStatus: true,
        employmentType: true,
        currentDepartmentId: true,
        createdAt: true,
      },
    }),
  ])

  return success({ items: employees, total, page, limit, totalPages: Math.ceil(total / limit) })
}, 'employee.view')

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

  const data = parsed.data
  const employeeId = await getNextEmployeeId()
  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')

  const employee = await prisma.employee.create({
    data: {
      employeeId,
      firstName: data.firstName,
      middleName: data.middleName || null,
      lastName: data.lastName,
      fullName,
      email: data.email || null,
      phoneNumber: data.phoneNumber || null,
      gender: data.gender || 'NOT_SPECIFIED',
      employmentType: data.employmentType ? (data.employmentType as never) : null,
      currentRole: data.currentRole ? (data.currentRole as never) : 'OTHER',
      currentLevel: data.currentLevel ? (data.currentLevel as never) : 'TO_BE_DEFINED',
      currentDepartmentId: data.currentDepartmentId || null,
      createdById: ctx.userId,
    },
  })

  await createAuditLog({
    userId: ctx.userId,
    action: 'EMPLOYEE_CREATE',
    entityType: 'Employee',
    entityId: employee.id,
    newValue: { employeeId: employee.employeeId, fullName: employee.fullName },
  })

  return success(employee, 201)
}, 'employee.create')
