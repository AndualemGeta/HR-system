import { prisma } from './prisma'
import type { AuditAction } from '@prisma/client'

export interface AuditEntry {
  userId?: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string | null
}

export async function createAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      oldValue: entry.oldValue ?? undefined,
      newValue: entry.newValue ?? undefined,
      ipAddress: entry.ipAddress ?? null,
    },
  })
}
