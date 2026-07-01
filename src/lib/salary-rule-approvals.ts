import { prisma } from './prisma'
import { createAuditLog } from './audit'
import { validateRuleForActivation } from './salary-structure'

export async function requestRuleActivation(ruleId: string, userId: string, reason?: string) {
  const rule = await prisma.payRule.findUnique({ where: { id: ruleId } })
  if (!rule) throw new Error('Rule not found')
  if (rule.status === 'ACTIVE') throw new Error('Rule is already active')

  const request = await prisma.salaryRuleApprovalRequest.create({
    data: {
      ruleId,
      actionType: 'ACTIVATE',
      status: 'SUBMITTED',
      requestedById: userId,
      requestReason: reason || null,
      validationJson: JSON.stringify(await validateRuleForActivation(ruleId)),
    },
  })
  await createAuditLog({ userId, action: 'SALARY_RULE_APPROVAL_REQUEST', entityType: 'SalaryRuleApprovalRequest', entityId: request.id, newValue: { ruleId, actionType: 'ACTIVATE' } })
  return request
}

export async function requestRuleDeactivation(ruleId: string, userId: string, reason?: string) {
  const rule = await prisma.payRule.findUnique({ where: { id: ruleId } })
  if (!rule) throw new Error('Rule not found')
  if (rule.status !== 'ACTIVE') throw new Error('Only active rules can be deactivated')

  const request = await prisma.salaryRuleApprovalRequest.create({
    data: {
      ruleId,
      actionType: 'DEACTIVATE',
      status: 'SUBMITTED',
      requestedById: userId,
      requestReason: reason || null,
    },
  })
  await createAuditLog({ userId, action: 'SALARY_RULE_APPROVAL_REQUEST', entityType: 'SalaryRuleApprovalRequest', entityId: request.id, newValue: { ruleId, actionType: 'DEACTIVATE' } })
  return request
}

export async function approveRuleApproval(requestId: string, userId: string) {
  const request = await prisma.salaryRuleApprovalRequest.findUnique({
    where: { id: requestId },
    include: { rule: true },
  })
  if (!request) throw new Error('Request not found')
  if (request.requestedById === userId) throw new Error('Requester cannot approve own request')
  if (request.status !== 'SUBMITTED' && request.status !== 'UNDER_REVIEW') throw new Error('Request is not pending')

  await prisma.salaryRuleApprovalRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
  })

  if (request.actionType === 'ACTIVATE') {
    await prisma.payRule.update({ where: { id: request.ruleId }, data: { status: 'ACTIVE' } })
  } else if (request.actionType === 'DEACTIVATE') {
    await prisma.payRule.update({ where: { id: request.ruleId }, data: { status: 'INACTIVE' } })
  }

  await prisma.salaryRuleApprovalRequest.update({
    where: { id: requestId },
    data: { status: 'APPLIED', appliedAt: new Date() },
  })
  await createAuditLog({ userId, action: 'SALARY_RULE_APPROVAL_APPROVE', entityType: 'SalaryRuleApprovalRequest', entityId: requestId, newValue: { status: 'APPROVED', action: request.actionType } })
}

export async function rejectRuleApproval(requestId: string, userId: string, comment: string) {
  const request = await prisma.salaryRuleApprovalRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error('Request not found')
  if (request.status !== 'SUBMITTED' && request.status !== 'UNDER_REVIEW') throw new Error('Request is not pending')

  const updated = await prisma.salaryRuleApprovalRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', rejectedById: userId, reviewComment: comment, rejectedAt: new Date() },
  })
  await createAuditLog({ userId, action: 'SALARY_RULE_APPROVAL_REJECT', entityType: 'SalaryRuleApprovalRequest', entityId: requestId, oldValue: { status: request.status }, newValue: { status: 'REJECTED', comment } })
  return updated
}
