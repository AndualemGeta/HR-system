import { CompensationRecommendation, EvaluationStatus, EvaluationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canEvaluateEmployee, hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    evaluationId: string;
  }>;
};

const evaluationPatchSchema = z.object({
  evaluationPeriodStart: z.string().optional(),
  evaluationPeriodEnd: z.string().optional(),
  evaluationType: z.nativeEnum(EvaluationType).optional(),
  score: z.coerce.number().min(0).max(100).nullable().optional(),
  rating: z.enum(["EXCELLENT", "VERY_GOOD", "GOOD", "NEEDS_IMPROVEMENT", "POOR"]).nullable().optional(),
  comments: z.string().nullable().optional(),
  strengths: z.string().nullable().optional(),
  improvementAreas: z.string().nullable().optional(),
  compensationRecommendation: z.nativeEnum(CompensationRecommendation).optional(),
  salaryReviewRequired: z.coerce.boolean().optional(),
  commissionReviewRequired: z.coerce.boolean().optional(),
  status: z.nativeEnum(EvaluationStatus).optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("evaluation.update");
  if (isApiError(principal)) return principal;

  const { evaluationId } = await context.params;
  const existing = await prisma.employeeEvaluation.findUnique({
    where: { id: evaluationId },
    include: { employee: true }
  });
  if (!existing) return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });

  const parsed = evaluationPatchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  if (nextStatus === "SUBMITTED" && !hasPermission(principal, "evaluation.submit")) {
    return NextResponse.json({ error: "Permission denied for evaluation submission." }, { status: 403 });
  }
  if (nextStatus === "REVIEWED" && !hasPermission(principal, "evaluation.review")) {
    return NextResponse.json({ error: "Permission denied for evaluation review." }, { status: 403 });
  }
  if (["APPROVED", "REJECTED"].includes(nextStatus ?? "") && !hasPermission(principal, "evaluation.approve")) {
    return NextResponse.json({ error: "Permission denied for evaluation approval." }, { status: 403 });
  }

  if (
    !hasPermission(principal, "evaluation.view_all") &&
    !canEvaluateEmployee(principal, {
      id: existing.employee.id,
      currentRole: existing.employee.currentRole,
      currentDepartmentId: existing.employee.currentDepartmentId,
      currentRegionId: existing.employee.currentRegionId,
      currentShopId: existing.employee.currentShopId,
      currentClusterId: existing.employee.currentClusterId,
      directManagerId: existing.employee.directManagerId
    })
  ) {
    return NextResponse.json({ error: "Evaluation is outside your reporting scope." }, { status: 403 });
  }

  const updated = await prisma.employeeEvaluation.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.evaluationPeriodStart ? { evaluationPeriodStart: new Date(parsed.data.evaluationPeriodStart) } : {}),
      ...(parsed.data.evaluationPeriodEnd ? { evaluationPeriodEnd: new Date(parsed.data.evaluationPeriodEnd) } : {}),
      ...(parsed.data.evaluationType ? { evaluationType: parsed.data.evaluationType } : {}),
      ...(parsed.data.score !== undefined ? { score: parsed.data.score } : {}),
      ...(parsed.data.rating !== undefined ? { rating: parsed.data.rating } : {}),
      ...(parsed.data.comments !== undefined ? { comments: parsed.data.comments } : {}),
      ...(parsed.data.strengths !== undefined ? { strengths: parsed.data.strengths } : {}),
      ...(parsed.data.improvementAreas !== undefined ? { improvementAreas: parsed.data.improvementAreas } : {}),
      ...(parsed.data.compensationRecommendation ? { compensationRecommendation: parsed.data.compensationRecommendation } : {}),
      ...(parsed.data.salaryReviewRequired !== undefined ? { salaryReviewRequired: parsed.data.salaryReviewRequired } : {}),
      ...(parsed.data.commissionReviewRequired !== undefined ? { commissionReviewRequired: parsed.data.commissionReviewRequired } : {}),
      ...(nextStatus
        ? {
            status: nextStatus,
            submittedDate: nextStatus === "SUBMITTED" ? new Date() : existing.submittedDate,
            reviewedById: nextStatus === "REVIEWED" ? principal.id : existing.reviewedById,
            approvedById: ["APPROVED", "REJECTED"].includes(nextStatus) ? principal.id : existing.approvedById
          }
        : {})
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action:
      nextStatus === "SUBMITTED"
        ? "EVALUATION_SUBMISSION"
        : nextStatus === "REVIEWED"
          ? "EVALUATION_REVIEW"
          : nextStatus === "APPROVED"
            ? "EVALUATION_APPROVAL"
            : nextStatus === "REJECTED"
              ? "EVALUATION_REJECTION"
              : parsed.data.compensationRecommendation || parsed.data.salaryReviewRequired !== undefined || parsed.data.commissionReviewRequired !== undefined
                ? "EVALUATION_COMPENSATION_RECOMMENDATION_UPDATE"
                : "EVALUATION_UPDATE",
    entityType: "EmployeeEvaluation",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ evaluation: updated });
}

async function readRequestData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}
