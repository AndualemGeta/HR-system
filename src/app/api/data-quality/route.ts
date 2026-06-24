import { DataQualityIssueType, DataQualitySeverity } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewDataQualityIssue, employeeToScope } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional().nullable());

const issueSchema = z.object({
  issueType: z.nativeEnum(DataQualityIssueType),
  severity: z.nativeEnum(DataQualitySeverity),
  employeeId: optionalString,
  relatedEntityType: optionalString,
  relatedEntityId: optionalString,
  description: z.string().min(1),
  suggestedFix: optionalString,
  assignedToId: optionalString
});

export async function GET() {
  const principal = await requirePermission("data_quality.view");
  if (isApiError(principal)) return principal;

  const issues = await prisma.dataQualityIssue.findMany({
    include: { employee: true },
    orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
    take: 300
  });

  return NextResponse.json({
    issues: issues.filter((issue) => canViewDataQualityIssue(principal, issue.employee ? employeeToScope(issue.employee) : undefined))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("data_quality.assign");
  if (isApiError(principal)) return principal;

  const parsed = issueSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data quality issue.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = parsed.data.employeeId
    ? await prisma.employee.findFirst({ where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] } })
    : null;
  if (parsed.data.employeeId && !employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (employee && !canViewDataQualityIssue(principal, employeeToScope(employee))) {
    return NextResponse.json({ error: "Employee is outside your data quality scope." }, { status: 403 });
  }

  const issue = await prisma.dataQualityIssue.create({
    data: {
      ...parsed.data,
      employeeId: employee?.id,
      detectedById: principal.id
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "DATA_QUALITY_CREATE",
    entityType: "DataQualityIssue",
    entityId: issue.id,
    newValue: issue
  });

  return NextResponse.json({ issue }, { status: 201 });
}
