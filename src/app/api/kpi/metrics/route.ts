import { EmployeeRole, KpiMetricType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional().nullable());

const metricSchema = z.object({
  name: z.string().min(1),
  description: optionalString,
  metricType: z.nativeEnum(KpiMetricType),
  applicableRole: z.preprocess(emptyToUndefined, z.nativeEnum(EmployeeRole).optional().nullable()),
  applicableDepartmentId: optionalString,
  applicableDivisionId: optionalString,
  unit: optionalString,
  activeStatus: z.coerce.boolean().default(true)
});

export async function GET() {
  const principal = await requirePermission("kpi.view");
  if (isApiError(principal)) return principal;

  const metrics = await prisma.kpiMetric.findMany({
    orderBy: [{ activeStatus: "desc" }, { name: "asc" }],
    take: 200
  });
  return NextResponse.json({ metrics });
}

export async function POST(request: Request) {
  const principal = await requirePermission("kpi.create");
  if (isApiError(principal)) return principal;

  const parsed = metricSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid KPI metric.", details: parsed.error.flatten() }, { status: 400 });
  }

  const metric = await prisma.kpiMetric.create({
    data: { ...parsed.data, createdById: principal.id }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "KPI_METRIC_CHANGE",
    entityType: "KpiMetric",
    entityId: metric.id,
    newValue: metric
  });

  return NextResponse.json({ metric }, { status: 201 });
}
