import { ReminderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { reminderComputedStatus } from "@/lib/phase4-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

type RouteContext = {
  params: Promise<{ reminderId: string }>;
};

const updateSchema = z.object({
  status: z.nativeEnum(ReminderStatus).optional(),
  dueDate: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  description: z.preprocess(emptyToUndefined, z.string().optional().nullable())
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("reminder.complete");
  if (isApiError(principal)) return principal;

  const { reminderId } = await context.params;
  const parsed = updateSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reminder update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.hRReminder.findUnique({ where: { id: reminderId } });
  if (!existing) return NextResponse.json({ error: "Reminder not found." }, { status: 404 });

  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : existing.dueDate;
  const nextStatus = reminderComputedStatus(dueDate, parsed.data.status ?? existing.status);
  const reminder = await prisma.hRReminder.update({
    where: { id: existing.id },
    data: {
      dueDate,
      description: parsed.data.description ?? existing.description,
      status: nextStatus,
      completedById: nextStatus === "COMPLETED" ? principal.id : existing.completedById,
      completedAt: nextStatus === "COMPLETED" ? new Date() : existing.completedAt
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: nextStatus === "COMPLETED" ? "REMINDER_COMPLETE" : nextStatus === "CANCELLED" ? "REMINDER_CANCEL" : "REMINDER_UPDATE",
    entityType: "HRReminder",
    entityId: reminder.id,
    oldValue: { status: existing.status, dueDate: existing.dueDate },
    newValue: { status: reminder.status, dueDate: reminder.dueDate }
  });

  return NextResponse.json({ reminder });
}
