import { DataQualityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const patchSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(["RESOLVED", "DISMISSED"])
});

export async function GET() {
  const principal = await requirePermission("payroll_validation.view");
  if (isApiError(principal)) return principal;
  const issues = await prisma.payrollValidationIssue.findMany({
    include: { employee: { select: { employeeId: true, fullName: true } }, payrollBatch: { select: { batchName: true } } },
    orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
    take: 300
  });
  return NextResponse.json({ issues });
}

export async function PATCH(request: Request) {
  const principal = await requirePermission("payroll_validation.resolve");
  if (isApiError(principal)) return principal;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll validation update.", details: parsed.error.flatten() }, { status: 400 });
  const issue = await prisma.payrollValidationIssue.update({
    where: { id: parsed.data.issueId },
    data: { status: parsed.data.status as DataQualityStatus, resolvedById: principal.id, resolvedAt: new Date() }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.status === "RESOLVED" ? "PAYROLL_VALIDATION_ISSUE_RESOLVE" : "PAYROLL_VALIDATION_ISSUE_DISMISS",
    entityType: "PayrollValidationIssue",
    entityId: issue.id,
    newValue: { status: issue.status }
  });
  return NextResponse.json({ issue });
}
