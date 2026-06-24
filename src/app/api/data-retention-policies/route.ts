import { DataRetentionEntityType, RetentionAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateRetentionPolicy } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  entityType: z.nativeEnum(DataRetentionEntityType),
  retentionPeriodDays: z.coerce.number().int(),
  actionAfterRetention: z.nativeEnum(RetentionAction).default("REVIEW_REQUIRED"),
  activeStatus: z.coerce.boolean().default(true)
});

export async function GET() {
  const principal = await requirePermission("data_retention.view");
  if (isApiError(principal)) return principal;
  const policies = await prisma.dataRetentionPolicy.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return NextResponse.json({ policies });
}

export async function POST(request: Request) {
  const principal = await requirePermission("data_retention.manage");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid data retention policy.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateRetentionPolicy(parsed.data);
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const policy = await prisma.dataRetentionPolicy.create({ data: { ...parsed.data, createdById: principal.id } });
  await writeAuditLog({ userId: principal.id, action: "DATA_RETENTION_POLICY_CHANGE", entityType: "DataRetentionPolicy", entityId: policy.id, newValue: policy });
  return NextResponse.json({ policy }, { status: 201 });
}
