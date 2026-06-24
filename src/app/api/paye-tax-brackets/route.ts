import { PayrollRuleApprovalStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { payeBracketsOverlap, validateEffectiveDates, validatePayeBracket } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const bracketSchema = z.object({
  name: z.string().min(1),
  minIncome: z.coerce.number(),
  maxIncome: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  taxRate: z.coerce.number(),
  deductionAmount: z.coerce.number().default(0),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  activeStatus: z.coerce.boolean().default(true),
  approvalStatus: z.nativeEnum(PayrollRuleApprovalStatus).default("DRAFT"),
  changeReason: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  isSample: z.coerce.boolean().default(false)
});

export async function GET() {
  const principal = await requirePermission("paye_tax.view");
  if (isApiError(principal)) return principal;
  const brackets = await prisma.payeTaxBracket.findMany({ orderBy: [{ activeStatus: "desc" }, { minIncome: "asc" }], take: 200 });
  return NextResponse.json({ brackets });
}

export async function POST(request: Request) {
  const principal = await requirePermission("paye_tax.manage");
  if (isApiError(principal)) return principal;
  const parsed = bracketSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid PAYE bracket.", details: parsed.error.flatten() }, { status: 400 });
  const issues = [...validateEffectiveDates(parsed.data), ...validatePayeBracket(parsed.data)];
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  if (parsed.data.approvalStatus === "APPROVED" && !parsed.data.changeReason) {
    return NextResponse.json({ error: "Approved PAYE brackets require a change reason for audit review." }, { status: 422 });
  }
  const existing = await prisma.payeTaxBracket.findMany({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false }, select: { minIncome: true, maxIncome: true } });
  if (
    parsed.data.activeStatus &&
    payeBracketsOverlap(
      { minIncome: parsed.data.minIncome, maxIncome: parsed.data.maxIncome },
      existing.map((bracket) => ({ minIncome: bracket.minIncome.toNumber(), maxIncome: bracket.maxIncome?.toNumber() ?? null }))
    )
  ) {
    return NextResponse.json({ error: "Active PAYE bracket income ranges cannot overlap." }, { status: 422 });
  }
  const bracket = await prisma.payeTaxBracket.create({
    data: {
      ...parsed.data,
      minIncome: new Prisma.Decimal(parsed.data.minIncome),
      maxIncome: parsed.data.maxIncome == null ? null : new Prisma.Decimal(parsed.data.maxIncome),
      taxRate: new Prisma.Decimal(parsed.data.taxRate),
      deductionAmount: new Prisma.Decimal(parsed.data.deductionAmount),
      effectiveStartDate: new Date(parsed.data.effectiveStartDate),
      effectiveEndDate: parsed.data.effectiveEndDate ? new Date(parsed.data.effectiveEndDate) : null,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      reviewedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      createdById: principal.id
    }
  });
  await writeAuditLog({ userId: principal.id, action: "PAYE_BRACKET_CREATE", entityType: "PayeTaxBracket", entityId: bracket.id, newValue: bracket });
  return NextResponse.json({ bracket }, { status: 201 });
}
