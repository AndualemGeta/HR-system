import { PayrollRuleApprovalStatus, PayrollRuleType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateEffectiveDates } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const ruleSchema = z.object({
  ruleType: z.nativeEnum(PayrollRuleType),
  name: z.string().min(1),
  description: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  value: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  rate: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  amount: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  activeStatus: z.coerce.boolean().default(true),
  approvalStatus: z.nativeEnum(PayrollRuleApprovalStatus).default("DRAFT"),
  changeReason: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  isSample: z.coerce.boolean().default(false)
});

export async function GET() {
  const principal = await requirePermission("payroll_rule.view");
  if (isApiError(principal)) return principal;
  const rules = await prisma.payrollRule.findMany({ orderBy: [{ activeStatus: "desc" }, { ruleType: "asc" }, { name: "asc" }], take: 300 });
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_rule.create");
  if (isApiError(principal)) return principal;
  const parsed = ruleSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll rule.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateEffectiveDates(parsed.data);
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  if (parsed.data.approvalStatus === "APPROVED" && !parsed.data.changeReason) {
    return NextResponse.json({ error: "Approved payroll rules require a change reason for audit review." }, { status: 422 });
  }

  const rule = await prisma.payrollRule.create({
    data: {
      ...parsed.data,
      rate: parsed.data.rate == null ? null : new Prisma.Decimal(parsed.data.rate),
      amount: parsed.data.amount == null ? null : new Prisma.Decimal(parsed.data.amount),
      effectiveStartDate: new Date(parsed.data.effectiveStartDate),
      effectiveEndDate: parsed.data.effectiveEndDate ? new Date(parsed.data.effectiveEndDate) : null,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      reviewedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      createdById: principal.id
    }
  });
  await writeAuditLog({ userId: principal.id, action: "PAYROLL_RULE_CREATE", entityType: "PayrollRule", entityId: rule.id, newValue: rule });
  return NextResponse.json({ rule }, { status: 201 });
}
