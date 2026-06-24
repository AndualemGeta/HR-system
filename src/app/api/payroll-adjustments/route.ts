import { ApprovalStatus, PayrollAdjustmentType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validatePayrollAdjustment } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  employeeId: z.string().min(1),
  payrollPeriodStart: z.string().min(1),
  payrollPeriodEnd: z.string().min(1),
  adjustmentType: z.nativeEnum(PayrollAdjustmentType),
  amount: z.coerce.number(),
  reason: z.string().min(1),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("SUBMITTED"),
  appliedToBatchId: z.string().optional().nullable()
});

export async function GET() {
  const principal = await requirePermission("payroll_adjustment.view");
  if (isApiError(principal)) return principal;
  const adjustments = await prisma.payrollAdjustment.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ adjustments });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_adjustment.create");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll adjustment.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validatePayrollAdjustment(parsed.data);
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  if (parsed.data.approvalStatus === "APPROVED") {
    const approver = await requirePermission("payroll_adjustment.approve");
    if (isApiError(approver)) return approver;
  }
  const adjustment = await prisma.payrollAdjustment.create({
    data: {
      employeeId: parsed.data.employeeId,
      payrollPeriodStart: new Date(parsed.data.payrollPeriodStart),
      payrollPeriodEnd: new Date(parsed.data.payrollPeriodEnd),
      adjustmentType: parsed.data.adjustmentType,
      amount: new Prisma.Decimal(parsed.data.amount),
      reason: parsed.data.reason,
      requestedById: principal.id,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      approvalStatus: parsed.data.approvalStatus,
      appliedToBatchId: parsed.data.appliedToBatchId
    }
  });
  await writeAuditLog({ userId: principal.id, action: parsed.data.approvalStatus === "APPROVED" ? "PAYROLL_ADJUSTMENT_APPROVAL" : "PAYROLL_ADJUSTMENT_CREATE", entityType: "PayrollAdjustment", entityId: adjustment.id, newValue: adjustment });
  return NextResponse.json({ adjustment }, { status: 201 });
}
