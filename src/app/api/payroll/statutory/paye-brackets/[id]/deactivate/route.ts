import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.approve'))) return forbidden()
    const { id } = await params
    const bracket = await prisma.payeTaxBracket.findUnique({ where: { id } })
    if (!bracket) return notFound()
    if (!bracket.isActive) return badRequest('Already inactive')
    const updated = await prisma.payeTaxBracket.update({
      where: { id },
      data: { isActive: false },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PAYE_DEACTIVATE', entityType: 'PayeTaxBracket', entityId: id, newValue: { isActive: false }, oldValue: { isActive: bracket.isActive } })
    return success(updated)
  } catch (e) { console.error(e); return internalError() }
}
