import { EmployeeLevel, EmployeeRole, PromotionRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { submitApprovalRequest } from "@/lib/approvals";
import { completePromotion, decimalFromForm, redactPromotionSalary } from "@/lib/phase3-actions";
import { canApproveLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { validatePromotionApproval } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { canUpdateSalary, hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ promotionId: string }>;
};

const patchSchema = z.object({
  proposedRole: z.nativeEnum(EmployeeRole).nullable().optional(),
  proposedLevel: z.nativeEnum(EmployeeLevel).nullable().optional(),
  proposedSalary: z.unknown().optional(),
  salaryEffectiveDate: z.string().nullable().optional(),
  reason: z.string().optional(),
  supportingEvaluationId: z.string().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  status: z.nativeEnum(PromotionRequestStatus).optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const principal = await requirePermission("promotion.view");
  if (isApiError(principal)) return principal;

  const { promotionId } = await context.params;
  const promotion = await prisma.promotionRequest.findUnique({ where: { id: promotionId }, include: { employee: true } });
  if (!promotion) return NextResponse.json({ error: "Promotion request not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(promotion.employee), "promotion.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  return NextResponse.json({ promotion: redactPromotionSalary(promotion, principal) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("promotion.update");
  if (isApiError(principal)) return principal;

  const { promotionId } = await context.params;
  const existing = await prisma.promotionRequest.findUnique({ where: { id: promotionId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "Promotion request not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(existing.employee), "promotion.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid promotion update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const proposedSalary = decimalFromForm(parsed.data.proposedSalary);
  if (proposedSalary && !canUpdateSalary(principal)) {
    return NextResponse.json({ error: "Salary changes require salary update permission." }, { status: 403 });
  }

  const nextStatus = parsed.data.status;
  if (nextStatus === "SUBMITTED" && !hasPermission(principal, "promotion.submit")) {
    return NextResponse.json({ error: "Permission denied for submission." }, { status: 403 });
  }
  if (nextStatus === "APPROVED" && !canApproveLifecycleRecord(principal, "promotion.approve")) {
    return NextResponse.json({ error: "Permission denied for approval." }, { status: 403 });
  }
  if (["APPROVED", "COMPLETED"].includes(nextStatus ?? "")) {
    const issues = validatePromotionApproval({
      proposedRole: parsed.data.proposedRole ?? existing.proposedRole,
      proposedLevel: parsed.data.proposedLevel ?? existing.proposedLevel,
      proposedSalary: proposedSalary?.toNumber() ?? existing.proposedSalary?.toNumber() ?? null,
      effectiveDate: parsed.data.effectiveDate ?? existing.effectiveDate,
      canChangeSalary: canUpdateSalary(principal)
    });
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }
  if (nextStatus === "COMPLETED") {
    if (!hasPermission(principal, "promotion.complete")) return NextResponse.json({ error: "Permission denied for completion." }, { status: 403 });
    try {
      return NextResponse.json({ promotion: redactPromotionSalary(await completePromotion({ principal, promotionId: existing.id }), principal) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Promotion completion failed." }, { status: 422 });
    }
  }

  const updated = await prisma.promotionRequest.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.proposedRole !== undefined ? { proposedRole: parsed.data.proposedRole } : {}),
      ...(parsed.data.proposedLevel !== undefined ? { proposedLevel: parsed.data.proposedLevel } : {}),
      ...(parsed.data.proposedSalary !== undefined ? { proposedSalary: proposedSalary ?? null } : {}),
      ...(parsed.data.salaryEffectiveDate !== undefined
        ? { salaryEffectiveDate: parsed.data.salaryEffectiveDate ? new Date(parsed.data.salaryEffectiveDate) : null }
        : {}),
      ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      ...(parsed.data.supportingEvaluationId !== undefined ? { supportingEvaluationId: parsed.data.supportingEvaluationId } : {}),
      ...(parsed.data.effectiveDate !== undefined ? { effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null } : {}),
      ...(nextStatus ? { status: nextStatus, approvedById: nextStatus === "APPROVED" ? principal.id : existing.approvedById } : {})
    },
    include: { employee: true }
  });

  if (nextStatus === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "PROMOTION",
      entityType: "PromotionRequest",
      entityId: updated.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: auditActionForPromotion(nextStatus),
    entityType: "PromotionRequest",
    entityId: updated.id,
    oldValue: redactPromotionSalary(existing, principal),
    newValue: redactPromotionSalary(updated, principal)
  });

  return NextResponse.json({ promotion: redactPromotionSalary(updated, principal) });
}

function auditActionForPromotion(status?: PromotionRequestStatus) {
  if (status === "SUBMITTED") return "PROMOTION_SUBMISSION";
  if (status === "APPROVED") return "PROMOTION_APPROVAL";
  if (status === "REJECTED") return "PROMOTION_REJECTION";
  return "PROMOTION_UPDATE";
}
