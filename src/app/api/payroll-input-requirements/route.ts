import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  inputTypeId: z.string().min(1),
  role: z.string().optional(),
  employeeCategory: z.string().optional(),
  departmentId: z.string().optional(),
  regionId: z.string().optional(),
  areaId: z.string().optional(),
  shopId: z.string().optional(),
  employmentType: z.string().optional(),
  isRequired: z.boolean().optional().default(true),
  severity: z.enum(['BLOCKER', 'WARNING', 'INFO']).optional().default('BLOCKER'),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputRequirement.view'))) return forbidden()
    const requirements = await prisma.payrollInputRequirement.findMany({
      include: { inputType: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return success(requirements)
  } catch (err) { console.error(err); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputRequirement.manage'))) return forbidden()
    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const requirement = await prisma.payrollInputRequirement.create({
      data: { ...parsed.data, createdById: session.userId, updatedById: session.userId } as any,
      include: { inputType: { select: { id: true, code: true, name: true } } },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_REQUIREMENT_CREATE', entityType: 'PayrollInputRequirement', entityId: requirement.id, newValue: parsed.data })
    return success(requirement)
  } catch (err) { console.error(err); return internalError() }
}
