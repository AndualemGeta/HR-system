import { EmployeeLevel, EmployeeRole, PromotionRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { submitApprovalRequest } from "@/lib/approvals";
import { decimalFromForm } from "@/lib/phase3-actions";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { validatePromotionApproval } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { canUpdateSalary } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const promotionSchema = z.object({
  employeeId: z.string().min(1),
  proposedRole: z.nativeEnum(EmployeeRole).optional().nullable(),
  proposedLevel: z.nativeEnum(EmployeeLevel).optional().nullable(),
  proposedSalary: z.unknown().optional(),
  salaryEffectiveDate: z.string().optional().nullable(),
  reason: z.string().min(1),
  supportingEvaluationId: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  status: z.nativeEnum(PromotionRequestStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("promotion.view");
  if (isApiError(principal)) return principal;

  const promotions = await prisma.promotionRequest.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({
    promotions: promotions
      .filter((promotion) => canViewLifecycleRecord(principal, employeeToScope(promotion.employee), "promotion.view"))
      .map((promotion) => (canUpdateSalary(principal) ? promotion : { ...promotion, proposedSalary: null }))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("promotion.create");
  if (isApiError(principal)) return principal;

  const raw = await readRequestData(request);
  const parsed = promotionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid promotion request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canCreateLifecycleRecord(principal, employeeToScope(employee), "promotion.create")) {
    return NextResponse.json({ error: "Employee is outside your promotion scope." }, { status: 403 });
  }

  const proposedSalary = decimalFromForm(parsed.data.proposedSalary);
  if (proposedSalary && !canUpdateSalary(principal)) {
    return NextResponse.json({ error: "Salary changes require salary update permission." }, { status: 403 });
  }
  const issues = validatePromotionApproval({
    proposedRole: parsed.data.proposedRole,
    proposedLevel: parsed.data.proposedLevel,
    proposedSalary: proposedSalary?.toNumber(),
    effectiveDate: parsed.data.status === "APPROVED" ? parsed.data.effectiveDate : new Date(),
    canChangeSalary: canUpdateSalary(principal)
  });
  if (parsed.data.status === "APPROVED" && issues.length > 0) {
    return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const promotion = await prisma.promotionRequest.create({
    data: {
      employeeId: employee.id,
      currentRole: employee.currentRole,
      currentLevel: employee.currentLevel,
      proposedRole: parsed.data.proposedRole,
      proposedLevel: parsed.data.proposedLevel,
      proposedSalary,
      salaryEffectiveDate: parsed.data.salaryEffectiveDate ? new Date(parsed.data.salaryEffectiveDate) : null,
      reason: parsed.data.reason,
      supportingEvaluationId: parsed.data.supportingEvaluationId,
      effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null,
      initiatedById: principal.id,
      status: parsed.data.status
    },
    include: { employee: true }
  });

  if (promotion.status === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "PROMOTION",
      entityType: "PromotionRequest",
      entityId: promotion.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: promotion.status === "SUBMITTED" ? "PROMOTION_SUBMISSION" : "PROMOTION_CREATE",
    entityType: "PromotionRequest",
    entityId: promotion.id,
    newValue: canUpdateSalary(principal) ? promotion : { ...promotion, proposedSalary: null }
  });

  return NextResponse.json({ promotion: canUpdateSalary(principal) ? promotion : { ...promotion, proposedSalary: null } }, { status: 201 });
}
