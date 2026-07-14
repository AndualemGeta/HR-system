import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  employeeRate: z.number().min(0).max(100),
  employerRate: z.number().min(0).max(100),
  pensionBaseType: z.enum(['BASIC_SALARY', 'PENSIONABLE_EARNINGS', 'CUSTOM_COMPONENTS']).default('BASIC_SALARY'),
  minimumBase: z.number().min(0).nullable().optional(),
  maximumBase: z.number().min(0).nullable().optional(),
  priority: z.number().int().default(0),
  applicableEmploymentType: z.string().nullable().optional(),
  applicableRole: z.string().nullable().optional(),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.view'))) return forbidden()
    const rules = await prisma.pensionRule.findMany({ orderBy: [{ effectiveStartDate: 'desc' }, { priority: 'asc' }] })
    return success(rules)
  } catch (e) { console.error(e); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.manage'))) return forbidden()
    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const d = parsed.data
    const rule = await prisma.pensionRule.create({
      data: {
        name: d.name,
        employeeRate: d.employeeRate,
        employerRate: d.employerRate,
        pensionBaseType: d.pensionBaseType as never,
        minimumBase: d.minimumBase ?? null,
        maximumBase: d.maximumBase ?? null,
        priority: d.priority,
        applicableEmploymentType: d.applicableEmploymentType as never ?? null,
        applicableRole: d.applicableRole as never ?? null,
        effectiveStartDate: new Date(d.effectiveStartDate),
        effectiveEndDate: d.effectiveEndDate ? new Date(d.effectiveEndDate) : null,
        isActive: true,
        approvalStatus: 'DRAFT',
        createdById: session.userId,
      },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PENSION_CREATE', entityType: 'PensionRule', entityId: rule.id, newValue: { name: d.name } })
    return success(rule)
  } catch (e) { console.error(e); return internalError() }
}
