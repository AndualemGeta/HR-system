import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { assertPayrollInputInUserScope } from '@/lib/payroll-scope'

const unlockSchema = z.object({ reason: z.string().min(1, 'Unlock reason is required') })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.unlock'))) return forbidden()
    const user = await prisma.user.findUnique({ where: { id: session.userId }, include: { roles: { include: { role: true } } } })
    if (!user) return unauthorized()
    const roleNames = user.roles.map(r => r.role.name)
    if (!roleNames.some(r => ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_DIRECTOR'].includes(r))) return forbidden('Only HR Admin, Finance Director, or Super Admin can unlock inputs.')
    const body = await req.json().catch(() => ({}))
    const parsed = unlockSchema.safeParse(body)
    if (!parsed.success) return badRequest('Unlock reason is required.')
    const input = await prisma.payrollInput.findUnique({ where: { id: inputId } })
    if (!input) return notFound('Input not found')
    if (!input.isLocked) return badRequest('Input is not locked.')
    const scope = await assertPayrollInputInUserScope(session.userId, inputId)
    if (!scope.allowed) return forbidden(scope.error)
    const updated = await prisma.payrollInput.update({
      where: { id: inputId },
      data: { isLocked: false, lockedById: null, lockedAt: null, lockReason: parsed.data.reason },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_INPUT_UNLOCK', entityType: 'PayrollInput', entityId: inputId, oldValue: { isLocked: true }, newValue: { isLocked: false, reason: parsed.data.reason } })
    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
