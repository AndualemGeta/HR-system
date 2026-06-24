import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ allowanceId: string }> };
const patchSchema = z.object({ approvalStatus: z.nativeEnum(ApprovalStatus) });

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_allowance.approve");
  if (isApiError(principal)) return principal;
  const { allowanceId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid allowance approval.", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.payrollAllowance.findUnique({ where: { id: allowanceId } });
  if (!existing) return NextResponse.json({ error: "Allowance not found." }, { status: 404 });
  const allowance = await prisma.payrollAllowance.update({
    where: { id: allowanceId },
    data: { approvalStatus: parsed.data.approvalStatus, approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : existing.approvedById }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.approvalStatus === "APPROVED" ? "PAYROLL_ALLOWANCE_APPROVAL" : "PAYROLL_ALLOWANCE_REJECTION",
    entityType: "PayrollAllowance",
    entityId: allowance.id,
    oldValue: { approvalStatus: existing.approvalStatus },
    newValue: { approvalStatus: allowance.approvalStatus }
  });
  return NextResponse.json({ allowance });
}
