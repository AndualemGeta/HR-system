import { prisma } from './prisma'
import { createAuditLog } from './audit'

const DEFAULT_ITEMS = [
  { section: 'Phase 3.5', item: 'Data quality dashboard reviewed' },
  { section: 'Phase 3.5', item: 'Sensitive change request tested' },
  { section: 'Phase 3.5', item: 'Salary change approval tested' },
  { section: 'Phase 3.5', item: 'Bank/M-PESA change approval tested' },
  { section: 'Phase 3.5', item: 'Tax/Pension ID change approval tested' },
  { section: 'Phase 3.5', item: 'Salary rule activation approval tested' },
  { section: 'Phase 3.5', item: 'Requester cannot approve own request' },
  { section: 'Phase 3.5', item: 'Employee cannot access controls' },
  { section: 'Phase 3.5', item: 'Audit logs created' },
  { section: 'Phase 3.5', item: 'Quality gates passed' },
  { section: 'Phase 3.5', item: 'HR sign-off completed' },
  { section: 'Phase 3.5', item: 'Finance sign-off completed' },
  { section: 'Phase 1', item: 'Employee registration completed' },
  { section: 'Phase 2A', item: 'Documents and onboarding completed' },
  { section: 'Phase 2B', item: 'Import and payroll readiness completed' },
  { section: 'Phase 3', item: 'Salary structure rules completed' },
]

export async function initializeChecklist() {
  for (const entry of DEFAULT_ITEMS) {
    await prisma.phaseControlChecklist.upsert({
      where: { section_item: { section: entry.section, item: entry.item } },
      update: {},
      create: { section: entry.section, item: entry.item, status: 'NOT_STARTED' },
    })
  }
}

export async function updateChecklistItem(id: string, status: string, comment: string | null, userId: string) {
  const updated = await prisma.phaseControlChecklist.update({
    where: { id },
    data: { status, comment, updatedById: userId },
  })
  await createAuditLog({ userId, action: 'PHASE_CONTROL_UPDATE', entityType: 'PhaseControlChecklist', entityId: id, oldValue: {}, newValue: { status, comment } })
  return updated
}

export async function getChecklist() {
  return prisma.phaseControlChecklist.findMany({ orderBy: [{ section: 'asc' }, { item: 'asc' }] })
}
