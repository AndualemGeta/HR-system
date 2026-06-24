import { PayrollExportFormat, PayrollExportTargetSystem } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validatePayrollExportTemplate } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  exportFormat: z.nativeEnum(PayrollExportFormat).default("CSV"),
  targetSystem: z.nativeEnum(PayrollExportTargetSystem).default("INTERNAL_FINANCE"),
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
  const principal = await requirePermission("payroll_export_template.view");
  if (isApiError(principal)) return principal;
  const templates = await prisma.payrollExportTemplate.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_export_template.create");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll export template.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validatePayrollExportTemplate(parsed.data);
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const template = await prisma.payrollExportTemplate.create({ data: { ...parsed.data, createdById: principal.id } });
  await writeAuditLog({ userId: principal.id, action: "PAYROLL_EXPORT_TEMPLATE_CREATE", entityType: "PayrollExportTemplate", entityId: template.id, newValue: template });
  return NextResponse.json({ template }, { status: 201 });
}
