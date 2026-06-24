import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ deductionId: string }> };
const patchSchema = z.object({ approvalStatus: z.nativeEnum(ApprovalStatus) });

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_deduction.approve");
  if (isApiError(principal)) return principal;
  const { deductionId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid deduction approval.", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.payrollDeduction.findUnique({ where: { id: deductionId } });
  if (!existing) return NextResponse.json({ error: "Deduction not found." }, { status: 404 });
  const deduction = await prisma.payrollDeduction.update({
    where: { id: deductionId },
    data: { approvalStatus: parsed.data.approvalStatus, approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : existing.approvedById }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.approvalStatus === "APPROVED" ? "PAYROLL_DEDUCTION_APPROVAL" : "PAYROLL_DEDUCTION_REJECTION",
    entityType: "PayrollDeduction",
    entityId: deduction.id,
    oldValue: { approvalStatus: existing.approvalStatus },
    newValue: { approvalStatus: deduction.approvalStatus }
  });
  return NextResponse.json({ deduction });
}
