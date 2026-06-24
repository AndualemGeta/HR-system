import { EmployeeRole, EmploymentType, PayrollRuleApprovalStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateEffectiveDates, validatePensionRule } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const pensionSchema = z.object({
  name: z.string().min(1),
  employeeRate: z.coerce.number(),
  employerRate: z.coerce.number(),
  applicableEmploymentType: z.preprocess(emptyToUndefined, z.nativeEnum(EmploymentType).optional().nullable()),
  applicableRole: z.preprocess(emptyToUndefined, z.nativeEnum(EmployeeRole).optional().nullable()),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  activeStatus: z.coerce.boolean().default(true),
  approvalStatus: z.nativeEnum(PayrollRuleApprovalStatus).default("DRAFT"),
  changeReason: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  isSample: z.coerce.boolean().default(false)
});

export async function GET() {
  const principal = await requirePermission("pension_rule.view");
  if (isApiError(principal)) return principal;
  const rules = await prisma.pensionRule.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const principal = await requirePermission("pension_rule.manage");
  if (isApiError(principal)) return principal;
  const parsed = pensionSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pension rule.", details: parsed.error.flatten() }, { status: 400 });
  const issues = [...validateEffectiveDates(parsed.data), ...validatePensionRule(parsed.data)];
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  if (parsed.data.approvalStatus === "APPROVED" && !parsed.data.changeReason) {
    return NextResponse.json({ error: "Approved pension rules require a change reason for audit review." }, { status: 422 });
  }
  const rule = await prisma.pensionRule.create({
    data: {
      ...parsed.data,
      employeeRate: new Prisma.Decimal(parsed.data.employeeRate),
      employerRate: new Prisma.Decimal(parsed.data.employerRate),
      effectiveStartDate: new Date(parsed.data.effectiveStartDate),
      effectiveEndDate: parsed.data.effectiveEndDate ? new Date(parsed.data.effectiveEndDate) : null,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      reviewedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      createdById: principal.id
    }
  });
  await writeAuditLog({ userId: principal.id, action: "PENSION_RULE_CREATE", entityType: "PensionRule", entityId: rule.id, newValue: rule });
  return NextResponse.json({ rule }, { status: 201 });
}
