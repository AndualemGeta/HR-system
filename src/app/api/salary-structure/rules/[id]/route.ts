import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.view'))) return forbidden()

    const rule = await prisma.payRule.findUnique({
      where: { id },
      include: { component: true },
    })
    if (!rule) return notFound('Rule not found')
    return success(rule)
  } catch (err) { console.error(err); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salaryStructure.manageRules'))) return forbidden()

    const rule = await prisma.payRule.findUnique({ where: { id } })
    if (!rule) return notFound('Rule not found')

    const body = await req.json()

    if (body.status === 'ACTIVE') {
      return new Response(JSON.stringify({ error: 'Cannot set ACTIVE via PATCH; use the activate endpoint' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const upd: Record<string, unknown> = { updatedById: session.userId }
    const fields = ['name', 'description', 'employeeCategory', 'role', 'departmentId', 'regionId', 'areaId', 'shopId', 'employmentType', 'ruleType', 'calculationMethod', 'baseAmount', 'percentageRate', 'maxAmount', 'minAmount', 'thresholdValue', 'thresholdMetric', 'tierConfigJson', 'formulaJson', 'requiresManualInput', 'requiresApproval', 'status', 'priority'] as const
    for (const f of fields) {
      if ((body as any)[f] !== undefined) upd[f] = (body as any)[f]
    }
    if (body.effectiveFrom !== undefined) upd.effectiveFrom = new Date(body.effectiveFrom)
    if (body.effectiveTo !== undefined) upd.effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null

    const updated = await prisma.payRule.update({ where: { id }, data: upd as any })

    await createAuditLog({
      userId: session.userId,
      action: 'PAY_RULE_UPDATE',
      entityType: 'PayRule',
      entityId: id,
      oldValue: { name: rule.name, status: rule.status },
      newValue: { name: updated.name, status: updated.status },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
