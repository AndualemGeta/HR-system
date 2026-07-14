import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  employeeRate: z.number().min(0).max(100).optional(),
  employerRate: z.number().min(0).max(100).optional(),
  pensionBaseType: z.enum(['BASIC_SALARY', 'PENSIONABLE_EARNINGS', 'CUSTOM_COMPONENTS']).optional(),
  minimumBase: z.number().min(0).nullable().optional(),
  maximumBase: z.number().min(0).nullable().optional(),
  priority: z.number().int().optional(),
  applicableEmploymentType: z.string().nullable().optional(),
  applicableRole: z.string().nullable().optional(),
  effectiveStartDate: z.string().min(1).optional(),
  effectiveEndDate: z.string().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.view'))) return forbidden()
    const { id } = await params
    const rule = await prisma.pensionRule.findUnique({ where: { id } })
    if (!rule) return notFound()
    return success(rule)
  } catch (e) { console.error(e); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.manage'))) return forbidden()
    const { id } = await params
    const existing = await prisma.pensionRule.findUnique({ where: { id } })
    if (!existing) return notFound()
    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const d = parsed.data
    const updateData: Record<string, unknown> = {}
    if (d.name !== undefined) updateData.name = d.name
    if (d.employeeRate !== undefined) updateData.employeeRate = d.employeeRate
    if (d.employerRate !== undefined) updateData.employerRate = d.employerRate
    if (d.pensionBaseType !== undefined) updateData.pensionBaseType = d.pensionBaseType
    if (d.minimumBase !== undefined) updateData.minimumBase = d.minimumBase
    if (d.maximumBase !== undefined) updateData.maximumBase = d.maximumBase
    if (d.priority !== undefined) updateData.priority = d.priority
    if (d.applicableEmploymentType !== undefined) updateData.applicableEmploymentType = d.applicableEmploymentType
    if (d.applicableRole !== undefined) updateData.applicableRole = d.applicableRole
    if (d.effectiveStartDate !== undefined) updateData.effectiveStartDate = new Date(d.effectiveStartDate)
    if (d.effectiveEndDate !== undefined) updateData.effectiveEndDate = d.effectiveEndDate ? new Date(d.effectiveEndDate) : null
    const rule = await prisma.pensionRule.update({ where: { id }, data: updateData })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PENSION_UPDATE', entityType: 'PensionRule', entityId: id, newValue: updateData, oldValue: { name: existing.name } })
    return success(rule)
  } catch (e) { console.error(e); return internalError() }
}
