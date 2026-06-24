import { ReminderType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { employeeToScope } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { canViewEmployee } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional().nullable());

const reminderSchema = z.object({
  title: z.string().min(1),
  description: optionalString,
  reminderType: z.nativeEnum(ReminderType),
  relatedEmployeeId: optionalString,
  relatedEntityType: optionalString,
  relatedEntityId: optionalString,
  dueDate: z.string().min(1),
  assignedToId: optionalString
});

export async function GET() {
  const principal = await requirePermission("reminder.view");
  if (isApiError(principal)) return principal;

  const reminders = await prisma.hRReminder.findMany({
    include: { relatedEmployee: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 300
  });

  return NextResponse.json({
    reminders: reminders.filter(
      (reminder) =>
        reminder.assignedToId === principal.id ||
        !reminder.relatedEmployee ||
        canViewEmployee(principal, employeeToScope(reminder.relatedEmployee))
    )
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("reminder.create");
  if (isApiError(principal)) return principal;

  const parsed = reminderSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reminder.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = parsed.data.relatedEmployeeId
    ? await prisma.employee.findFirst({ where: { OR: [{ id: parsed.data.relatedEmployeeId }, { employeeId: parsed.data.relatedEmployeeId }] } })
    : null;
  if (parsed.data.relatedEmployeeId && !employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (employee && !canViewEmployee(principal, employeeToScope(employee))) {
    return NextResponse.json({ error: "Employee is outside your reminder scope." }, { status: 403 });
  }

  const reminder = await prisma.hRReminder.create({
    data: {
      ...parsed.data,
      relatedEmployeeId: employee?.id,
      dueDate: new Date(parsed.data.dueDate),
      createdById: principal.id
    }
  });

  if (reminder.assignedToId) {
    await createNotification({
      recipientUserId: reminder.assignedToId,
      title: "Reminder assigned",
      message: reminder.title,
      notificationType: "REMINDER",
      relatedEntityType: "HRReminder",
      relatedEntityId: reminder.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: "REMINDER_CREATE",
    entityType: "HRReminder",
    entityId: reminder.id,
    newValue: reminder
  });

  return NextResponse.json({ reminder }, { status: 201 });
}
