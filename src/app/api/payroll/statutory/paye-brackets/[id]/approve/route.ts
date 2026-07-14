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
    if (bracket.approvalStatus === 'APPROVED') return badRequest('Already approved')
    const updated = await prisma.payeTaxBracket.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', isActive: true, isSample: false },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PAYE_APPROVE', entityType: 'PayeTaxBracket', entityId: id, newValue: { approvalStatus: 'APPROVED' }, oldValue: { approvalStatus: bracket.approvalStatus } })
    return success(updated)
  } catch (e) { console.error(e); return internalError() }
}
