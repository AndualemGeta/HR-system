import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  fieldMapping: z.preprocess(parseJsonObject, z.record(z.string())),
  activeStatus: z.coerce.boolean().default(true)
});

function parseJsonObject(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET() {
  const principal = await requirePermission("kpi_import_template.view");
  if (isApiError(principal)) return principal;
  const templates = await prisma.kpiImportTemplate.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const principal = await requirePermission("kpi_import_template.manage");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid KPI import template.", details: parsed.error.flatten() }, { status: 400 });
  if (Object.keys(parsed.data.fieldMapping).length === 0) return NextResponse.json({ error: "KPI import template requires field mapping." }, { status: 422 });
  const template = await prisma.kpiImportTemplate.create({ data: { ...parsed.data, createdById: principal.id } });
  await writeAuditLog({ userId: principal.id, action: "KPI_IMPORT_TEMPLATE_CHANGE", entityType: "KpiImportTemplate", entityId: template.id, newValue: template });
  return NextResponse.json({ template }, { status: 201 });
}
