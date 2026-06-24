import { CompensationRecommendation, EvaluationStatus, EvaluationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canEvaluateEmployee, canViewEmployee, hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const evaluationSchema = z.object({
  employeeId: z.string(),
  evaluatorEmployeeId: z.string().optional(),
  evaluationPeriodStart: z.string(),
  evaluationPeriodEnd: z.string(),
  evaluationType: z.nativeEnum(EvaluationType),
  score: z.coerce.number().min(0).max(100).optional(),
  rating: z.enum(["EXCELLENT", "VERY_GOOD", "GOOD", "NEEDS_IMPROVEMENT", "POOR"]).optional(),
  comments: z.string().optional(),
  strengths: z.string().optional(),
  improvementAreas: z.string().optional(),
  compensationRecommendation: z.nativeEnum(CompensationRecommendation).default("NO_CHANGE"),
  salaryReviewRequired: z.coerce.boolean().default(false),
  commissionReviewRequired: z.coerce.boolean().default(false),
  status: z.nativeEnum(EvaluationStatus).default("DRAFT"),
  scoreItems: z
    .array(
      z.object({
        criteriaId: z.string().min(1),
        score: z.coerce.number().min(0),
        comments: z.string().optional().nullable()
      })
    )
    .optional()
});

export async function GET() {
  const principal = await requirePermission("evaluation.view");
  if (isApiError(principal)) return principal;

  const evaluations = await prisma.employeeEvaluation.findMany({
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          currentRole: true,
          currentDepartmentId: true,
          currentRegionId: true,
          currentShopId: true,
          currentClusterId: true,
          directManagerId: true
        }
      },
      evaluator: { select: { id: true, employeeId: true, fullName: true } },
      scoreItems: { include: { criteria: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({
    evaluations: evaluations.filter((evaluation) =>
      hasPermission(principal, "evaluation.view_all")
        ? true
        : canViewEmployee(principal, {
            id: evaluation.employee.id,
            currentRole: evaluation.employee.currentRole,
            currentDepartmentId: evaluation.employee.currentDepartmentId,
            currentRegionId: evaluation.employee.currentRegionId,
            currentShopId: evaluation.employee.currentShopId,
            currentClusterId: evaluation.employee.currentClusterId,
            directManagerId: evaluation.employee.directManagerId
          })
    )
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("evaluation.create");
  if (isApiError(principal)) return principal;

  const payload = evaluationSchema.parse(await readRequestData(request));
  if (payload.status === "SUBMITTED" && !hasPermission(principal, "evaluation.submit")) {
    return NextResponse.json({ error: "Permission denied for evaluation submission." }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: payload.employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const evaluator = payload.evaluatorEmployeeId
    ? await prisma.employee.findUnique({ where: { id: payload.evaluatorEmployeeId } })
    : principal.employeeId
      ? await prisma.employee.findUnique({ where: { id: principal.employeeId } })
      : null;

  if (!evaluator) return NextResponse.json({ error: "Evaluator employee profile is required." }, { status: 422 });

  const allowed = canEvaluateEmployee(principal, {
    id: employee.id,
    currentRole: employee.currentRole,
    currentDepartmentId: employee.currentDepartmentId,
    currentRegionId: employee.currentRegionId,
    currentShopId: employee.currentShopId,
    currentClusterId: employee.currentClusterId,
    directManagerId: employee.directManagerId
  });

  if (!allowed) {
    return NextResponse.json({ error: "Evaluator is outside the permitted reporting scope." }, { status: 403 });
  }

  const evaluation = await prisma.employeeEvaluation.create({
    data: {
      employeeId: employee.id,
      evaluatorId: evaluator.id,
      evaluationPeriodStart: new Date(payload.evaluationPeriodStart),
      evaluationPeriodEnd: new Date(payload.evaluationPeriodEnd),
      evaluationType: payload.evaluationType,
      score: payload.score,
      rating: payload.rating,
      comments: payload.comments,
      strengths: payload.strengths,
      improvementAreas: payload.improvementAreas,
      compensationRecommendation: payload.compensationRecommendation,
      salaryReviewRequired: payload.salaryReviewRequired,
      commissionReviewRequired: payload.commissionReviewRequired,
      status: payload.status,
      submittedDate: payload.status === "SUBMITTED" ? new Date() : null,
      scoreItems: payload.scoreItems
        ? {
            create: payload.scoreItems.map((item) => ({
              criteriaId: item.criteriaId,
              score: item.score,
              comments: item.comments
            }))
          }
        : undefined
    },
    include: { scoreItems: true }
  });

  await writeAuditLog({
    userId: principal.id,
    action: payload.status === "SUBMITTED" ? "EVALUATION_SUBMISSION" : "EVALUATION_CREATE",
    entityType: "EmployeeEvaluation",
    entityId: evaluation.id,
    newValue: evaluation
  });

  return NextResponse.json({ evaluation }, { status: 201 });
}

async function readRequestData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}
