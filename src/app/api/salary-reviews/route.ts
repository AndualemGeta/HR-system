import { Prisma, SalaryReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewSalaryReviewForEmployee, employeeToScope, redactMoney } from "@/lib/phase45-access";
import { salaryReviewChange, validateSalaryReview } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { canViewEmployee } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const salaryReviewSchema = z.object({
  employeeId: z.string().min(1),
  proposedSalary: z.coerce.number(),
  reason: z.string().min(1),
  relatedEvaluationId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  effectiveDate: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  notes: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  status: z.nativeEnum(SalaryReviewStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("salary_review.view");
  if (isApiError(principal)) return principal;

  const reviews = await prisma.salaryReview.findMany({
    include: { employee: true, relatedEvaluation: { select: { id: true, status: true, compensationRecommendation: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({
    reviews: reviews
      .filter((review) => canViewSalaryReviewForEmployee(principal, employeeToScope(review.employee)))
      .map((review) => ({
        ...review,
        currentSalary: redactMoney(review.currentSalary, principal),
        proposedSalary: redactMoney(review.proposedSalary, principal),
        changeAmount: redactMoney(review.changeAmount, principal)
      }))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("salary_review.create");
  if (isApiError(principal)) return principal;

  const parsed = salaryReviewSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid salary review.", details: parsed.error.flatten() }, { status: 400 });

  const employee = await prisma.employee.findFirst({ where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canViewEmployee(principal, employeeToScope(employee))) {
    return NextResponse.json({ error: "Employee is outside your salary review scope." }, { status: 403 });
  }

  const relatedEvaluation = parsed.data.relatedEvaluationId
    ? await prisma.employeeEvaluation.findUnique({ where: { id: parsed.data.relatedEvaluationId } })
    : null;
  if (parsed.data.relatedEvaluationId && (!relatedEvaluation || relatedEvaluation.employeeId !== employee.id)) {
    return NextResponse.json({ error: "Related evaluation was not found for this employee." }, { status: 404 });
  }
  if (relatedEvaluation && relatedEvaluation.status !== "APPROVED") {
    return NextResponse.json({ error: "Only approved evaluations can drive salary review recommendations." }, { status: 422 });
  }

  const issues = validateSalaryReview(parsed.data);
  if (issues.some((issue) => issue.severity === "BLOCKER")) {
    return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const currentSalary = employee.basicSalary?.toNumber() ?? null;
  const change = salaryReviewChange(currentSalary, parsed.data.proposedSalary);
  const review = await prisma.salaryReview.create({
    data: {
      employeeId: employee.id,
      currentSalary: currentSalary == null ? null : new Prisma.Decimal(currentSalary),
      proposedSalary: new Prisma.Decimal(parsed.data.proposedSalary),
      changeAmount: new Prisma.Decimal(change.changeAmount),
      changePercent: new Prisma.Decimal(change.changePercent),
      reason: parsed.data.reason,
      relatedEvaluationId: parsed.data.relatedEvaluationId,
      effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null,
      requestedById: principal.id,
      status: parsed.data.status,
      notes: parsed.data.notes
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.status === "SUBMITTED" ? "SALARY_REVIEW_SUBMISSION" : "SALARY_REVIEW_CREATE",
    entityType: "SalaryReview",
    entityId: review.id,
    newValue: { id: review.id, employeeId: employee.employeeId, status: review.status, proposedSalary: "REDACTED" }
  });

  return NextResponse.json({ review }, { status: 201 });
}
