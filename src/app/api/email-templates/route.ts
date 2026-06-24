import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateEmailTemplate } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  notificationType: z.nativeEnum(NotificationType),
  subjectTemplate: z.string().min(1),
  bodyTemplate: z.string().min(1),
  activeStatus: z.coerce.boolean().default(true)
});

export async function GET() {
  const principal = await requirePermission("email_template.view");
  if (isApiError(principal)) return principal;
  const templates = await prisma.emailTemplate.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const principal = await requirePermission("email_template.manage");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email template.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateEmailTemplate({ ...parsed.data, recipientCanViewRestricted: false });
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const template = await prisma.emailTemplate.create({ data: { ...parsed.data, createdById: principal.id } });
  await writeAuditLog({ userId: principal.id, action: "EMAIL_TEMPLATE_CHANGE", entityType: "EmailTemplate", entityId: template.id, newValue: template });
  return NextResponse.json({ template }, { status: 201 });
}
