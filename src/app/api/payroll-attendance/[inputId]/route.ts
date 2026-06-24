import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ inputId: string }> };
const patchSchema = z.object({ approvalStatus: z.nativeEnum(ApprovalStatus) });

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_attendance.approve");
  if (isApiError(principal)) return principal;
  const { inputId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attendance approval.", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.payrollAttendanceInput.findUnique({ where: { id: inputId } });
  if (!existing) return NextResponse.json({ error: "Attendance input not found." }, { status: 404 });
  const input = await prisma.payrollAttendanceInput.update({
    where: { id: inputId },
    data: { approvalStatus: parsed.data.approvalStatus, approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : existing.approvedById }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.approvalStatus === "APPROVED" ? "PAYROLL_ATTENDANCE_APPROVAL" : "PAYROLL_ATTENDANCE_REJECTION",
    entityType: "PayrollAttendanceInput",
    entityId: input.id,
    oldValue: { approvalStatus: existing.approvalStatus },
    newValue: { approvalStatus: input.approvalStatus }
  });
  return NextResponse.json({ input });
}
