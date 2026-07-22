import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

import type { EmployeeRole, EmploymentType } from '@prisma/client'

async function validatePensionRule(rule: { id: string; applicableRole: EmployeeRole | null; applicableEmploymentType: EmploymentType | null; priority: number }): Promise<string | null> {
  const conflicts = await prisma.pensionRule.findMany({
    where: {
      id: { not: rule.id },
      approvalStatus: 'APPROVED',
      isActive: true,
      isSample: false,
      applicableRole: rule.applicableRole,
      applicableEmploymentType: rule.applicableEmploymentType,
      priority: rule.priority,
    },
  })
  if (conflicts.length > 0) {
    return `Overlapping approved rule "${conflicts[0].id}" has same role/employment type and priority — creates AMBIGUOUS_PENSION_RULE at runtime`
  }
  return null
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.approve'))) return forbidden()
    const { id } = await params
    const rule = await prisma.pensionRule.findUnique({ where: { id } })
    if (!rule) return notFound()
    if (rule.approvalStatus === 'APPROVED') return badRequest('Already approved')

    const validationError = await validatePensionRule({
      id: rule.id,
      applicableRole: rule.applicableRole as EmployeeRole | null,
      applicableEmploymentType: rule.applicableEmploymentType as EmploymentType | null,
      priority: rule.priority,
    })
    if (validationError) return badRequest(validationError)

    const updated = await prisma.pensionRule.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', isActive: true, isSample: false },
    })
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_STATUTORY_PENSION_APPROVE', entityType: 'PensionRule', entityId: id, newValue: { approvalStatus: 'APPROVED' }, oldValue: { approvalStatus: rule.approvalStatus } })
    return success(updated)
  } catch (e) { console.error(e); return internalError() }
}
