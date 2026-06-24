import { FinalPaymentStatus, TerminationStatus, TerminationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { submitApprovalRequest } from "@/lib/approvals";
import { canApproveLifecycleRecord, canCompleteExit, canUpdateFinalPayment, canViewLifecycleRecord } from "@/lib/phase3-access";
import { completeTerminationExit } from "@/lib/phase3-actions";
import { validateTerminationApproval } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

const patchSchema = z.object({
  terminationType: z.nativeEnum(TerminationType).optional(),
  reason: z.string().optional(),
  noticeDate: z.string().nullable().optional(),
  lastWorkingDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.nativeEnum(TerminationStatus).optional(),
  finalPaymentStatus: z.nativeEnum(FinalPaymentStatus).optional(),
  exitItemId: z.string().optional(),
  completed: z.coerce.boolean().optional(),
  overrideReason: z.string().nullable().optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const principal = await requirePermission("termination.view");
  if (isApiError(principal)) return principal;

  const { caseId } = await context.params;
  const termination = await prisma.terminationCase.findUnique({ where: { id: caseId }, include: { employee: true, exitItems: true } });
  if (!termination) return NextResponse.json({ error: "Termination case not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(termination.employee), "termination.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  return NextResponse.json({ termination });
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("termination.update");
  if (isApiError(principal)) return principal;

  const { caseId } = await context.params;
  const existing = await prisma.terminationCase.findUnique({ where: { id: caseId }, include: { employee: true, exitItems: true } });
  if (!existing) return NextResponse.json({ error: "Termination case not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(existing.employee), "termination.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid termination update.", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.exitItemId) {
    const item = await prisma.exitChecklistItem.update({
      where: { id: parsed.data.exitItemId },
      data: {
        completed: parsed.data.completed ?? true,
        completedById: principal.id,
        completedAt: parsed.data.completed === false ? null : new Date()
      }
    });
    await writeAuditLog({
      userId: principal.id,
      action: "TERMINATION_EXIT_CHECKLIST_UPDATE",
      entityType: "ExitChecklistItem",
      entityId: item.id,
      newValue: item
    });
    return NextResponse.json({ item });
  }

  if (parsed.data.finalPaymentStatus && !canUpdateFinalPayment(principal)) {
    return NextResponse.json({ error: "Permission denied for final payment updates." }, { status: 403 });
  }

  const nextStatus = parsed.data.status;
  if (nextStatus === "SUBMITTED" && !hasPermission(principal, "termination.submit")) {
    return NextResponse.json({ error: "Permission denied for submission." }, { status: 403 });
  }
  if (nextStatus === "UNDER_REVIEW" && !hasPermission(principal, "termination.review")) {
    return NextResponse.json({ error: "Permission denied for review." }, { status: 403 });
  }
  if (["APPROVED", "REJECTED"].includes(nextStatus ?? "") && !canApproveLifecycleRecord(principal, "termination.approve")) {
    return NextResponse.json({ error: "Permission denied for approval." }, { status: 403 });
  }
  if (nextStatus === "EXIT_COMPLETED") {
    if (!canCompleteExit(principal)) return NextResponse.json({ error: "Permission denied for exit completion." }, { status: 403 });
    try {
      const termination = await completeTerminationExit({
        principal,
        terminationId: existing.id,
        overrideReason: parsed.data.overrideReason
      });
      return NextResponse.json({ termination });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Exit completion failed." }, { status: 422 });
    }
  }

  if (nextStatus === "APPROVED") {
    const issues = validateTerminationApproval({
      reason: parsed.data.reason ?? existing.reason,
      lastWorkingDate: parsed.data.lastWorkingDate ?? existing.lastWorkingDate
    });
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const termination = await tx.terminationCase.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.terminationType ? { terminationType: parsed.data.terminationType } : {}),
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        ...(parsed.data.noticeDate !== undefined ? { noticeDate: parsed.data.noticeDate ? new Date(parsed.data.noticeDate) : null } : {}),
        ...(parsed.data.lastWorkingDate !== undefined
          ? { lastWorkingDate: parsed.data.lastWorkingDate ? new Date(parsed.data.lastWorkingDate) : null }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.finalPaymentStatus ? { finalPaymentStatus: parsed.data.finalPaymentStatus } : {}),
        ...(nextStatus
          ? {
              status: nextStatus,
              approvalStatus: nextStatus === "APPROVED" ? "APPROVED" : nextStatus === "REJECTED" ? "REJECTED" : existing.approvalStatus,
              reviewedById: nextStatus === "UNDER_REVIEW" ? principal.id : existing.reviewedById,
              approvedById: ["APPROVED", "REJECTED"].includes(nextStatus) ? principal.id : existing.approvedById
            }
          : {})
      },
      include: { employee: true, exitItems: true }
    });

    if (nextStatus === "APPROVED") {
      await tx.employee.update({
        where: { id: termination.employeeId },
        data: {
          employmentStatus: termination.terminationType === "RESIGNATION" ? "RESIGNED" : "TERMINATED",
          updatedById: principal.id
        }
      });
    }

    return termination;
  });

  if (nextStatus === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "TERMINATION",
      entityType: "TerminationCase",
      entityId: updated.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: auditActionForTermination(nextStatus, Boolean(parsed.data.finalPaymentStatus)),
    entityType: "TerminationCase",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ termination: updated });
}

function auditActionForTermination(status?: TerminationStatus, paymentChanged = false) {
  if (paymentChanged) return "TERMINATION_FINAL_PAYMENT_CHANGE";
  if (status === "SUBMITTED") return "TERMINATION_SUBMISSION";
  if (status === "UNDER_REVIEW") return "TERMINATION_REVIEW";
  if (status === "APPROVED") return "TERMINATION_APPROVAL";
  if (status === "REJECTED") return "TERMINATION_REJECTION";
  if (status === "CANCELLED") return "TERMINATION_CANCELLATION";
  return "TERMINATION_UPDATE";
}
