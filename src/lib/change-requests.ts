import { prisma } from './prisma'
import { createAuditLog } from './audit'

export const SENSITIVE_FIELDS = [
  'basicSalary', 'salaryEffectiveDate', 'paymentMethod', 'bankName',
  'bankAccountNumber', 'mpesaAccount', 'taxId', 'pensionId', 'costCenter',
] as const

export type SensitiveField = typeof SENSITIVE_FIELDS[number]

export function isSensitiveField(field: string): boolean {
  return SENSITIVE_FIELDS.includes(field as SensitiveField)
}

export async function createChangeRequest(params: {
  employeeId: string
  requestedField: string
  oldValue: string | null
  newValue: string
  reason?: string
  requestedById: string
}) {
  const request = await prisma.employeeProfileChangeRequest.create({
    data: {
      employeeId: params.employeeId,
      requestedField: params.requestedField,
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason || null,
      status: 'SUBMITTED',
      requestedById: params.requestedById,
    },
  })
  await createAuditLog({
    userId: params.requestedById,
    action: 'CHANGE_REQUEST_CREATE',
    entityType: 'EmployeeProfileChangeRequest',
    entityId: request.id,
    newValue: { requestedField: params.requestedField, oldValue: params.oldValue, newValue: params.newValue },
  })
  return request
}

export async function approveChangeRequest(requestId: string, userId: string) {
  const request = await prisma.employeeProfileChangeRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error('Request not found')
  if (request.requestedById === userId) throw new Error('Requester cannot approve own request')
  if (request.status !== 'SUBMITTED' && request.status !== 'UNDER_REVIEW') throw new Error('Request is not pending approval')

  const updated = await prisma.employeeProfileChangeRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
  })

  await applyChangeRequestField(request)
  await createAuditLog({ userId, action: 'CHANGE_REQUEST_APPROVE', entityType: 'EmployeeProfileChangeRequest', entityId: requestId, oldValue: { status: request.status }, newValue: { status: 'APPROVED' } })
  return updated
}

async function applyChangeRequestField(request: { id: string; employeeId: string; requestedField: string; newValue: string }) {
  const field = request.requestedField
  const payrollFields = ['paymentMethod', 'bankName', 'bankAccountNumber', 'mpesaAccount', 'taxId', 'pensionId', 'costCenter']

  if (field === 'basicSalary') {
    await prisma.employee.update({ where: { id: request.employeeId }, data: { basicSalary: Number(request.newValue) } })
  } else if (field === 'salaryEffectiveDate') {
    await prisma.employee.update({ where: { id: request.employeeId }, data: { salaryEffectiveDate: new Date(request.newValue) } })
  } else if (payrollFields.includes(field)) {
    const existing = await prisma.employeePayrollProfile.findUnique({ where: { employeeId: request.employeeId } })
    if (existing) {
      await prisma.employeePayrollProfile.update({ where: { employeeId: request.employeeId }, data: { [field]: request.newValue } })
    }
  }

  await prisma.employeeProfileChangeRequest.update({ where: { id: request.id }, data: { status: 'APPLIED', appliedAt: new Date() } })
  await createAuditLog({ action: 'CHANGE_REQUEST_APPLY', entityType: 'EmployeeProfileChangeRequest', entityId: request.id, newValue: { appliedField: field, appliedValue: request.newValue } })
}

export async function rejectChangeRequest(requestId: string, userId: string, comment: string) {
  const request = await prisma.employeeProfileChangeRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error('Request not found')
  if (request.status !== 'SUBMITTED' && request.status !== 'UNDER_REVIEW') throw new Error('Request is not pending')

  const updated = await prisma.employeeProfileChangeRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', rejectedById: userId, reviewComment: comment, rejectedAt: new Date() },
  })
  await createAuditLog({ userId, action: 'CHANGE_REQUEST_REJECT', entityType: 'EmployeeProfileChangeRequest', entityId: requestId, oldValue: { status: request.status }, newValue: { status: 'REJECTED', comment } })
  return updated
}

export async function cancelChangeRequest(requestId: string, userId: string) {
  const request = await prisma.employeeProfileChangeRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new Error('Request not found')
  if (request.requestedById !== userId) throw new Error('Only requester can cancel')

  const updated = await prisma.employeeProfileChangeRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  })
  await createAuditLog({ userId, action: 'CHANGE_REQUEST_CANCEL', entityType: 'EmployeeProfileChangeRequest', entityId: requestId, oldValue: { status: request.status }, newValue: { status: 'CANCELLED' } })
  return updated
}
