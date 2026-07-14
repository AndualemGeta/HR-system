import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { validatePayeSchedule } from '@/lib/payroll-paye-validation'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.approve'))) return forbidden()
    const { id } = await params
    const bracket = await prisma.payeTaxBracket.findUnique({ where: { id } })
    if (!bracket) return notFound()
    if (bracket.approvalStatus === 'APPROVED') return badRequest('Already approved')

    // If bracket belongs to a schedule, validate the entire schedule first
    if (bracket.scheduleCode) {
      const validation = await validatePayeSchedule(bracket.scheduleCode)
      if (!validation.valid) {
        return badRequest('Schedule validation failed', { errors: validation.errors.map(e => e.message) })
      }

      // Approve all brackets in the schedule
      const scheduleBrackets = await prisma.payeTaxBracket.findMany({
        where: { scheduleCode: bracket.scheduleCode, approvalStatus: { not: 'APPROVED' } },
      })
      for (const sb of scheduleBrackets) {
        await prisma.payeTaxBracket.update({
          where: { id: sb.id },
          data: { approvalStatus: 'APPROVED', isActive: true, isSample: false },
        })
      }

      if (scheduleBrackets.length > 0) {
        await createAuditLog({
          userId: session.userId, action: 'PAYROLL_STATUTORY_PAYE_APPROVE',
          entityType: 'PayeTaxBracket', entityId: id,
          newValue: { scheduleCode: bracket.scheduleCode, approvedCount: scheduleBrackets.length, approvalStatus: 'APPROVED' },
          oldValue: { approvalStatus: bracket.approvalStatus },
        })
      }

      return success({ approved: scheduleBrackets.length, scheduleCode: bracket.scheduleCode })
    }

    // No schedule code — single bracket approval (backwards compat)
    const updated = await prisma.payeTaxBracket.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', isActive: true, isSample: false },
    })
    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_STATUTORY_PAYE_APPROVE',
      entityType: 'PayeTaxBracket', entityId: id,
      newValue: { approvalStatus: 'APPROVED' }, oldValue: { approvalStatus: bracket.approvalStatus },
    })
    return success(updated)
  } catch (e) { console.error(e); return internalError() }
}
