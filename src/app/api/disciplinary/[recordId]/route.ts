import { DisciplinaryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { submitApprovalRequest } from "@/lib/approvals";
import { canApproveLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { validateDisciplinarySubmission } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

const patchSchema = z.object({
  incidentType: z.string().optional(),
  incidentDate: z.string().optional(),
  description: z.string().optional(),
  actionTaken: z.string().nullable().optional(),
  warningLevel: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  attachmentPath: z.string().nullable().optional(),
  status: z.nativeEnum(DisciplinaryStatus).optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const principal = await requirePermission("disciplinary.view");
  if (isApiError(principal)) return principal;

  const { recordId } = await context.params;
  const record = await prisma.disciplinaryRecord.findUnique({ where: { id: recordId }, include: { employee: true } });
  if (!record) return NextResponse.json({ error: "Disciplinary record not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(record.employee), "disciplinary.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  return NextResponse.json({ record });
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("disciplinary.update");
  if (isApiError(principal)) return principal;

  const { recordId } = await context.params;
  const existing = await prisma.disciplinaryRecord.findUnique({ where: { id: recordId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "Disciplinary record not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(existing.employee), "disciplinary.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid disciplinary update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  if (nextStatus === "SUBMITTED" && !hasPermission(principal, "disciplinary.submit")) {
    return NextResponse.json({ error: "Permission denied for submission." }, { status: 403 });
  }
  if (nextStatus === "UNDER_REVIEW" && !hasPermission(principal, "disciplinary.review")) {
    return NextResponse.json({ error: "Permission denied for review." }, { status: 403 });
  }
  if (["APPROVED", "REJECTED"].includes(nextStatus ?? "") && !canApproveLifecycleRecord(principal, "disciplinary.approve")) {
    return NextResponse.json({ error: "Permission denied for approval." }, { status: 403 });
  }
  if (nextStatus === "CLOSED" && !hasPermission(principal, "disciplinary.close")) {
    return NextResponse.json({ error: "Permission denied for closure." }, { status: 403 });
  }

  if (nextStatus === "SUBMITTED") {
    const issues = validateDisciplinarySubmission({
      employeeId: existing.employeeId,
      incidentType: parsed.data.incidentType ?? existing.incidentType,
      incidentDate: parsed.data.incidentDate ?? existing.incidentDate,
      description: parsed.data.description ?? existing.description
    });
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const updated = await prisma.disciplinaryRecord.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.incidentType ? { incidentType: parsed.data.incidentType } : {}),
      ...(parsed.data.incidentDate ? { incidentDate: new Date(parsed.data.incidentDate) } : {}),
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
      ...(parsed.data.actionTaken !== undefined ? { actionTaken: parsed.data.actionTaken } : {}),
      ...(parsed.data.warningLevel !== undefined ? { warningLevel: parsed.data.warningLevel } : {}),
      ...(parsed.data.followUpDate !== undefined
        ? { followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null }
        : {}),
      ...(parsed.data.attachmentPath !== undefined ? { attachmentPath: parsed.data.attachmentPath } : {}),
      ...(nextStatus
        ? {
            status: nextStatus,
            reviewedById: nextStatus === "UNDER_REVIEW" ? principal.id : existing.reviewedById,
            approvedById: ["APPROVED", "REJECTED"].includes(nextStatus) ? principal.id : existing.approvedById
          }
        : {})
    },
    include: { employee: true }
  });

  if (nextStatus === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "DISCIPLINARY",
      entityType: "DisciplinaryRecord",
      entityId: updated.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: auditActionForStatus(nextStatus),
    entityType: "DisciplinaryRecord",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ record: updated });
}

function auditActionForStatus(status?: DisciplinaryStatus) {
  if (status === "SUBMITTED") return "DISCIPLINARY_SUBMISSION";
  if (status === "UNDER_REVIEW") return "DISCIPLINARY_REVIEW";
  if (status === "APPROVED") return "DISCIPLINARY_APPROVAL";
  if (status === "REJECTED") return "DISCIPLINARY_REJECTION";
  if (status === "CLOSED") return "DISCIPLINARY_CLOSE";
  if (status === "ESCALATED") return "DISCIPLINARY_ESCALATION";
  return "DISCIPLINARY_UPDATE";
}
