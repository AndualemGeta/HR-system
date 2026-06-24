import { ApprovalStatus, LeaveType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { calculateInclusiveDays } from "@/lib/phase2-utils";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    leaveId: string;
  }>;
};

const leavePatchSchema = z.object({
  leaveType: z.nativeEnum(LeaveType).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().nullable().optional(),
  approvalStatus: z.nativeEnum(ApprovalStatus).optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("leave.update");
  if (isApiError(principal)) return principal;

  const { leaveId } = await context.params;
  const existing = await prisma.leaveRecord.findUnique({ where: { id: leaveId } });
  if (!existing) return NextResponse.json({ error: "Leave record not found." }, { status: 404 });

  const parsed = leavePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid leave update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const approvalStatus = parsed.data.approvalStatus;
  if (approvalStatus && ["APPROVED", "REJECTED", "CANCELLED"].includes(approvalStatus) && !hasPermission(principal, "leave.approve")) {
    return NextResponse.json({ error: "Permission denied for leave approval actions." }, { status: 403 });
  }

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;
  if (endDate < startDate) {
    return NextResponse.json({ error: "Leave end date cannot be before start date." }, { status: 422 });
  }

  const updated = await prisma.leaveRecord.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.leaveType ? { leaveType: parsed.data.leaveType } : {}),
      ...(parsed.data.startDate ? { startDate } : {}),
      ...(parsed.data.endDate ? { endDate } : {}),
      ...(parsed.data.startDate || parsed.data.endDate ? { totalDays: calculateInclusiveDays(startDate, endDate) } : {}),
      ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
      ...(approvalStatus
        ? {
            approvalStatus,
            approvedById: ["APPROVED", "REJECTED"].includes(approvalStatus) ? principal.id : existing.approvedById,
            approvedAt: ["APPROVED", "REJECTED"].includes(approvalStatus) ? new Date() : existing.approvedAt
          }
        : {})
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action:
      approvalStatus === "APPROVED"
        ? "LEAVE_APPROVAL"
        : approvalStatus === "REJECTED"
          ? "LEAVE_REJECTION"
          : approvalStatus === "CANCELLED"
            ? "LEAVE_CANCELLATION"
            : "LEAVE_UPDATE",
    entityType: "LeaveRecord",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ leaveRecord: updated });
}
