import { ApprovalStatus, LeaveType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  employeeId: z.string().min(1),
  leaveType: z.nativeEnum(LeaveType),
  adjustmentDays: z.coerce.number(),
  reason: z.string().min(1),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("SUBMITTED")
});

export async function GET() {
  const principal = await requirePermission("leave_balance.view");
  if (isApiError(principal)) return principal;
  const adjustments = await prisma.leaveBalanceAdjustment.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ adjustments });
}

export async function POST(request: Request) {
  const principal = await requirePermission("leave_balance.adjust");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid leave balance adjustment.", details: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.reason.trim()) return NextResponse.json({ error: "Leave balance adjustment requires a reason." }, { status: 422 });
  const adjustment = await prisma.leaveBalanceAdjustment.create({
    data: {
      employeeId: parsed.data.employeeId,
      leaveType: parsed.data.leaveType,
      adjustmentDays: new Prisma.Decimal(parsed.data.adjustmentDays),
      reason: parsed.data.reason,
      requestedById: principal.id,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      approvalStatus: parsed.data.approvalStatus
    }
  });
  await writeAuditLog({ userId: principal.id, action: "LEAVE_BALANCE_ADJUSTMENT", entityType: "LeaveBalanceAdjustment", entityId: adjustment.id, newValue: adjustment });
  return NextResponse.json({ adjustment }, { status: 201 });
}
