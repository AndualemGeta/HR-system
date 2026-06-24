import { EmployeeRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateKpiWeights } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  metricId: z.string().min(1),
  applicableRole: z.nativeEnum(EmployeeRole).optional().nullable(),
  applicableDepartmentId: z.string().optional().nullable(),
  weight: z.coerce.number(),
  activeStatus: z.coerce.boolean().default(true)
});

export async function GET() {
  const principal = await requirePermission("kpi_evaluation_linkage.manage");
  if (isApiError(principal)) return principal;
  const weights = await prisma.kpiEvaluationWeight.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ weights });
}

export async function POST(request: Request) {
  const principal = await requirePermission("kpi_evaluation_linkage.manage");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid KPI evaluation weight.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateKpiWeights([{ weight: parsed.data.weight }], false);
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const weight = await prisma.kpiEvaluationWeight.create({ data: { ...parsed.data, weight: new Prisma.Decimal(parsed.data.weight), createdById: principal.id } });
  await writeAuditLog({ userId: principal.id, action: "KPI_EVALUATION_WEIGHT_CHANGE", entityType: "KpiEvaluationWeight", entityId: weight.id, newValue: weight });
  return NextResponse.json({ weight }, { status: 201 });
}
