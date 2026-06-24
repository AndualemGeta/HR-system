import { CommissionCalculationType, EmployeeRole, EmploymentType, PayrollRuleApprovalStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateCommissionPlan } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const planSchema = z.object({
  name: z.string().min(1),
  description: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  applicableRole: z.preprocess(emptyToUndefined, z.nativeEnum(EmployeeRole).optional().nullable()),
  applicableDepartmentId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  applicableDivisionId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  employmentType: z.preprocess(emptyToUndefined, z.nativeEnum(EmploymentType).optional().nullable()),
  calculationType: z.nativeEnum(CommissionCalculationType),
  rate: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  thresholdAmount: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  fixedAmount: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  capAmount: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  activeStatus: z.coerce.boolean().default(true),
  approvalStatus: z.nativeEnum(PayrollRuleApprovalStatus).default("DRAFT"),
  changeReason: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  isSample: z.coerce.boolean().default(false),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.preprocess(emptyToUndefined, z.string().optional().nullable())
});

export async function GET() {
  const principal = await requirePermission("commission_plan.view");
  if (isApiError(principal)) return principal;
  const plans = await prisma.commissionPlan.findMany({ include: { tiers: { orderBy: { tierOrder: "asc" } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const principal = await requirePermission("commission_plan.create");
  if (isApiError(principal)) return principal;
  const parsed = planSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commission plan.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateCommissionPlan(parsed.data);
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  if (parsed.data.approvalStatus === "APPROVED" && !parsed.data.changeReason) {
    return NextResponse.json({ error: "Approved commission plans require a change reason for audit review." }, { status: 422 });
  }
  const plan = await prisma.commissionPlan.create({
    data: {
      ...parsed.data,
      rate: parsed.data.rate == null ? null : new Prisma.Decimal(parsed.data.rate),
      thresholdAmount: parsed.data.thresholdAmount == null ? null : new Prisma.Decimal(parsed.data.thresholdAmount),
      fixedAmount: parsed.data.fixedAmount == null ? null : new Prisma.Decimal(parsed.data.fixedAmount),
      capAmount: parsed.data.capAmount == null ? null : new Prisma.Decimal(parsed.data.capAmount),
      effectiveStartDate: new Date(parsed.data.effectiveStartDate),
      effectiveEndDate: parsed.data.effectiveEndDate ? new Date(parsed.data.effectiveEndDate) : null,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      reviewedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      createdById: principal.id
    }
  });
  await writeAuditLog({ userId: principal.id, action: "COMMISSION_PLAN_CREATE", entityType: "CommissionPlan", entityId: plan.id, newValue: plan });
  return NextResponse.json({ plan }, { status: 201 });
}
