import { Prisma, SalaryReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canManageSalaryReview, canViewSalaryReviewForEmployee, employeeToScope } from "@/lib/phase45-access";
import { salaryReviewChange, validateSalaryReview } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ reviewId: string }> };

const patchSchema = z.object({
  proposedSalary: z.coerce.number().optional(),
  reason: z.string().optional(),
  effectiveDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.nativeEnum(SalaryReviewStatus).optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("salary_review.update");
  if (isApiError(principal)) return principal;

  const { reviewId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid salary review update.", details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.salaryReview.findUnique({ where: { id: reviewId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "Salary review not found." }, { status: 404 });
  if (!canViewSalaryReviewForEmployee(principal, employeeToScope(existing.employee))) {
    return NextResponse.json({ error: "Salary review is outside your scope." }, { status: 403 });
  }

  const nextStatus = parsed.data.status ?? existing.status;
  if (["HR_REVIEW", "FINANCE_REVIEW"].includes(nextStatus) && !hasPermission(principal, "salary_review.review")) {
    return NextResponse.json({ error: "Salary review permission is required." }, { status: 403 });
  }
  if (["APPROVED", "REJECTED"].includes(nextStatus) && !hasPermission(principal, "salary_review.approve")) {
    return NextResponse.json({ error: "Salary approval permission is required." }, { status: 403 });
  }
  if (nextStatus === "COMPLETED" && (!hasPermission(principal, "salary_review.complete") || !canManageSalaryReview(principal))) {
    return NextResponse.json({ error: "Salary completion permission is required." }, { status: 403 });
  }

  const proposedSalary = parsed.data.proposedSalary ?? existing.proposedSalary.toNumber();
  const effectiveDate = parsed.data.effectiveDate !== undefined ? parsed.data.effectiveDate : existing.effectiveDate;
  const issues = validateSalaryReview({
    proposedSalary,
    effectiveDate,
    status: nextStatus,
    reason: parsed.data.reason ?? existing.reason
  });
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });

  const change = salaryReviewChange(existing.currentSalary?.toNumber() ?? null, proposedSalary);
  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.salaryReview.update({
      where: { id: existing.id },
      data: {
        proposedSalary: new Prisma.Decimal(proposedSalary),
        changeAmount: new Prisma.Decimal(change.changeAmount),
        changePercent: new Prisma.Decimal(change.changePercent),
        reason: parsed.data.reason ?? existing.reason,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        notes: parsed.data.notes ?? existing.notes,
        status: nextStatus,
        reviewedById: ["HR_REVIEW", "FINANCE_REVIEW", "APPROVED", "REJECTED", "COMPLETED"].includes(nextStatus) ? principal.id : existing.reviewedById,
        approvedById: ["APPROVED", "COMPLETED"].includes(nextStatus) ? principal.id : existing.approvedById,
        hrReviewStatus: ["HR_REVIEW", "APPROVED", "COMPLETED"].includes(nextStatus) ? "APPROVED" : existing.hrReviewStatus,
        financeReviewStatus: ["FINANCE_REVIEW", "APPROVED", "COMPLETED"].includes(nextStatus) ? "APPROVED" : existing.financeReviewStatus
      }
    });

    if (nextStatus === "COMPLETED") {
      const salary = await tx.employeeSalary.create({
        data: {
          employeeId: existing.employeeId,
          basicSalary: updated.proposedSalary,
          effectiveDate: updated.effectiveDate ?? new Date(),
          reason: `Salary review ${updated.id}: ${updated.reason}`,
          approvedById: principal.id,
          createdById: principal.id
        }
      });
      await tx.employee.update({
        where: { id: existing.employeeId },
        data: { basicSalary: updated.proposedSalary, salaryEffectiveDate: salary.effectiveDate }
      });
    }

    return updated;
  });

  await writeAuditLog({
    userId: principal.id,
    action:
      nextStatus === "SUBMITTED"
        ? "SALARY_REVIEW_SUBMISSION"
        : nextStatus === "HR_REVIEW"
          ? "SALARY_REVIEW_HR_REVIEW"
          : nextStatus === "FINANCE_REVIEW"
            ? "SALARY_REVIEW_FINANCE_REVIEW"
            : nextStatus === "APPROVED"
              ? "SALARY_REVIEW_APPROVAL"
              : nextStatus === "REJECTED"
                ? "SALARY_REVIEW_REJECTION"
                : nextStatus === "COMPLETED"
                  ? "SALARY_REVIEW_COMPLETION"
                  : "SALARY_REVIEW_UPDATE",
    entityType: "SalaryReview",
    entityId: review.id,
    oldValue: { status: existing.status, proposedSalary: "REDACTED" },
    newValue: { status: review.status, proposedSalary: "REDACTED" }
  });

  return NextResponse.json({ review });
}
