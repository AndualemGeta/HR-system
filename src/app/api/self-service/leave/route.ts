import { LeaveType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, requirePrincipal, isApiError } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { calculateInclusiveDays } from "@/lib/phase2-utils";

export const runtime = "nodejs";

const leaveRequestSchema = z.object({
  leaveType: z.nativeEnum(LeaveType),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const principal = await requirePrincipal();
  if (isApiError(principal)) return principal;
  if (!principal.employeeId) return jsonError("No linked employee record.", 400);
  if (!hasPermission(principal, "self_service.leave_request")) return jsonError("Permission denied.", 403);

  const parsed = leaveRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid leave request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: principal.employeeId } });
  if (!employee) return jsonError("Employee not found.", 404);

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) return jsonError("End date cannot be before start date.", 422);

  const leaveRecord = await prisma.leaveRecord.create({
    data: {
      employeeId: employee.id,
      leaveType: parsed.data.leaveType,
      startDate,
      endDate,
      totalDays: calculateInclusiveDays(startDate, endDate),
      reason: parsed.data.reason,
      approvalStatus: "PENDING",
      requestedById: principal.id
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "LEAVE_CREATE",
    entityType: "LeaveRecord",
    entityId: leaveRecord.id,
    newValue: { ...leaveRecord, source: "self_service" }
  });

  const hrUsers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roles: {
        some: { role: { name: { in: ["HR_ADMIN", "HR_MANAGER"] } } }
      }
    }
  });
  for (const hrUser of hrUsers) {
    await createNotification({
      recipientUserId: hrUser.id,
      title: "Leave Request Submitted",
      message: `${employee.fullName} requested ${parsed.data.leaveType} from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.`,
      notificationType: "APPROVAL_REQUIRED",
      relatedEntityType: "LeaveRecord",
      relatedEntityId: leaveRecord.id
    });
  }

  return NextResponse.json({ leaveRecord }, { status: 201 });
}
