import { DocumentType, EmployeeRole, EmploymentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const ruleSchema = z.object({
  name: z.string().min(1),
  documentType: z.nativeEnum(DocumentType),
  applicableEmploymentType: z.preprocess(emptyToUndefined, z.nativeEnum(EmploymentType).optional().nullable()),
  applicableRole: z.preprocess(emptyToUndefined, z.nativeEnum(EmployeeRole).optional().nullable()),
  applicableDepartmentId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  applicableDivisionId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  isRequired: z.coerce.boolean().default(true),
  activeStatus: z.coerce.boolean().default(true)
});

export async function GET() {
  const principal = await requirePermission("required_document_rule.view");
  if (isApiError(principal)) return principal;

  const rules = await prisma.requiredDocumentRule.findMany({
    orderBy: [{ activeStatus: "desc" }, { documentType: "asc" }, { name: "asc" }],
    take: 500
  });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const principal = await requirePermission("required_document_rule.manage");
  if (isApiError(principal)) return principal;

  const parsed = ruleSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid required document rule.", details: parsed.error.flatten() }, { status: 400 });
  }
  const hasScope = Boolean(
    parsed.data.applicableEmploymentType ||
      parsed.data.applicableRole ||
      parsed.data.applicableDepartmentId ||
      parsed.data.applicableDivisionId
  );
  if (!hasScope) {
    return NextResponse.json({ error: "Required document rules must define at least one applicable scope." }, { status: 422 });
  }

  const rule = await prisma.requiredDocumentRule.create({
    data: { ...parsed.data, createdById: principal.id }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "DATA_QUALITY_CREATE",
    entityType: "RequiredDocumentRule",
    entityId: rule.id,
    newValue: rule
  });

  return NextResponse.json({ rule }, { status: 201 });
}
