import { DataQualityStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePrincipal } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewDataQualityIssue, employeeToScope } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

type RouteContext = {
  params: Promise<{ issueId: string }>;
};

const updateSchema = z.object({
  status: z.nativeEnum(DataQualityStatus).optional(),
  assignedToId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  suggestedFix: z.preprocess(emptyToUndefined, z.string().optional().nullable())
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePrincipal();
  if (isApiError(principal)) return principal;

  const { issueId } = await context.params;
  const parsed = updateSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data quality update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.dataQualityIssue.findUnique({ where: { id: issueId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "Data quality issue not found." }, { status: 404 });
  if (!canViewDataQualityIssue(principal, existing.employee ? employeeToScope(existing.employee) : undefined)) {
    return NextResponse.json({ error: "Data quality issue is outside your scope." }, { status: 403 });
  }
  if (parsed.data.assignedToId !== undefined && !hasPermission(principal, "data_quality.assign")) {
    return NextResponse.json({ error: "Assignment permission is required." }, { status: 403 });
  }
  if (["RESOLVED", "DISMISSED"].includes(parsed.data.status ?? "") && !hasPermission(principal, "data_quality.resolve")) {
    return NextResponse.json({ error: "Resolution permission is required." }, { status: 403 });
  }

  const issue = await prisma.dataQualityIssue.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status ?? existing.status,
      assignedToId: parsed.data.assignedToId ?? existing.assignedToId,
      suggestedFix: parsed.data.suggestedFix ?? existing.suggestedFix,
      resolvedById: ["RESOLVED", "DISMISSED"].includes(parsed.data.status ?? "") ? principal.id : existing.resolvedById,
      resolvedAt: ["RESOLVED", "DISMISSED"].includes(parsed.data.status ?? "") ? new Date() : existing.resolvedAt
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.status === "DISMISSED" ? "DATA_QUALITY_DISMISS" : parsed.data.status === "RESOLVED" ? "DATA_QUALITY_RESOLVE" : "DATA_QUALITY_ASSIGN",
    entityType: "DataQualityIssue",
    entityId: issue.id,
    oldValue: { status: existing.status, assignedToId: existing.assignedToId },
    newValue: { status: issue.status, assignedToId: issue.assignedToId }
  });

  return NextResponse.json({ issue });
}
