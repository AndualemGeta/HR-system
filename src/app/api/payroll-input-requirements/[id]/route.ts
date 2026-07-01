import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const updateSchema = z.object({
  inputTypeId: z.string().min(1).optional(),
  role: z.string().nullable().optional(),
  employeeCategory: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  regionId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  shopId: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
  severity: z.enum(['BLOCKER', 'WARNING', 'INFO']).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputRequirement.view'))) return forbidden()
    const requirement = await prisma.payrollInputRequirement.findUnique({ where: { id }, include: { inputType: true } })
    if (!requirement) return notFound('Requirement not found')
    return success(requirement)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInputRequirement.manage'))) return forbidden()
    const existing = await prisma.payrollInputRequirement.findUnique({ where: { id } })
    if (!existing) return notFound('Requirement not found')
    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const updated = await prisma.payrollInputRequirement.update({
      where: { id },
      data: { ...parsed.data, updatedById: session.userId } as any,
      include: { inputType: { select: { id: true, code: true, name: true } } },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_REQUIREMENT_UPDATE', entityType: 'PayrollInputRequirement', entityId: id, oldValue: existing, newValue: updated })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
