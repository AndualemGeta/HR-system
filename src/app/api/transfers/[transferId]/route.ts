import type { EmployeeRoleValue } from "@/lib/constants";
import { EmployeeLevel, EmployeeRole, TransferRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { submitApprovalRequest } from "@/lib/approvals";
import { canApproveLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { completeTransfer } from "@/lib/phase3-actions";
import { validateTransferApproval } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ transferId: string }>;
};

const patchSchema = z.object({
  requestedDivisionId: z.string().nullable().optional(),
  requestedDepartmentId: z.string().nullable().optional(),
  requestedRegionId: z.string().nullable().optional(),
  requestedShopId: z.string().nullable().optional(),
  requestedClusterId: z.string().nullable().optional(),
  requestedRole: z.nativeEnum(EmployeeRole).nullable().optional(),
  requestedLevel: z.nativeEnum(EmployeeLevel).nullable().optional(),
  requestedManagerId: z.string().nullable().optional(),
  reason: z.string().optional(),
  effectiveDate: z.string().nullable().optional(),
  status: z.nativeEnum(TransferRequestStatus).optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const principal = await requirePermission("transfer.view");
  if (isApiError(principal)) return principal;

  const { transferId } = await context.params;
  const transfer = await prisma.transferRequest.findUnique({ where: { id: transferId }, include: { employee: true } });
  if (!transfer) return NextResponse.json({ error: "Transfer request not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(transfer.employee), "transfer.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  return NextResponse.json({ transfer });
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("transfer.update");
  if (isApiError(principal)) return principal;

  const { transferId } = await context.params;
  const existing = await prisma.transferRequest.findUnique({ where: { id: transferId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "Transfer request not found." }, { status: 404 });
  if (!canViewLifecycleRecord(principal, employeeToScope(existing.employee), "transfer.view")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  if (nextStatus === "SUBMITTED" && !hasPermission(principal, "transfer.submit")) {
    return NextResponse.json({ error: "Permission denied for submission." }, { status: 403 });
  }
  if (nextStatus === "APPROVED" && !canApproveLifecycleRecord(principal, "transfer.approve")) {
    return NextResponse.json({ error: "Permission denied for approval." }, { status: 403 });
  }
  if (nextStatus === "COMPLETED") {
    if (!hasPermission(principal, "transfer.complete")) return NextResponse.json({ error: "Permission denied for completion." }, { status: 403 });
    const issues = validateTransferApproval({
      requestedRole: (parsed.data.requestedRole ?? existing.requestedRole) as EmployeeRoleValue | null | undefined,
      requestedDepartmentId: parsed.data.requestedDepartmentId ?? existing.requestedDepartmentId,
      requestedRegionId: parsed.data.requestedRegionId ?? existing.requestedRegionId,
      requestedShopId: parsed.data.requestedShopId ?? existing.requestedShopId,
      requestedClusterId: parsed.data.requestedClusterId ?? existing.requestedClusterId,
      effectiveDate: parsed.data.effectiveDate ?? existing.effectiveDate
    });
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
    try {
      return NextResponse.json({ transfer: await completeTransfer({ principal, transferId: existing.id }) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Transfer completion failed." }, { status: 422 });
    }
  }

  if (nextStatus === "APPROVED") {
    const issues = validateTransferApproval({
      requestedRole: (parsed.data.requestedRole ?? existing.requestedRole) as EmployeeRoleValue | null | undefined,
      requestedDepartmentId: parsed.data.requestedDepartmentId ?? existing.requestedDepartmentId,
      requestedRegionId: parsed.data.requestedRegionId ?? existing.requestedRegionId,
      requestedShopId: parsed.data.requestedShopId ?? existing.requestedShopId,
      requestedClusterId: parsed.data.requestedClusterId ?? existing.requestedClusterId,
      effectiveDate: parsed.data.effectiveDate ?? existing.effectiveDate
    });
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const updated = await prisma.transferRequest.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.requestedDivisionId !== undefined ? { requestedDivisionId: parsed.data.requestedDivisionId } : {}),
      ...(parsed.data.requestedDepartmentId !== undefined ? { requestedDepartmentId: parsed.data.requestedDepartmentId } : {}),
      ...(parsed.data.requestedRegionId !== undefined ? { requestedRegionId: parsed.data.requestedRegionId } : {}),
      ...(parsed.data.requestedShopId !== undefined ? { requestedShopId: parsed.data.requestedShopId } : {}),
      ...(parsed.data.requestedClusterId !== undefined ? { requestedClusterId: parsed.data.requestedClusterId } : {}),
      ...(parsed.data.requestedRole !== undefined ? { requestedRole: parsed.data.requestedRole } : {}),
      ...(parsed.data.requestedLevel !== undefined ? { requestedLevel: parsed.data.requestedLevel } : {}),
      ...(parsed.data.requestedManagerId !== undefined ? { requestedManagerId: parsed.data.requestedManagerId } : {}),
      ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      ...(parsed.data.effectiveDate !== undefined ? { effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null } : {}),
      ...(nextStatus ? { status: nextStatus, approvedById: nextStatus === "APPROVED" ? principal.id : existing.approvedById } : {})
    },
    include: { employee: true }
  });

  if (nextStatus === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "TRANSFER",
      entityType: "TransferRequest",
      entityId: updated.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: auditActionForTransfer(nextStatus),
    entityType: "TransferRequest",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ transfer: updated });
}

function auditActionForTransfer(status?: TransferRequestStatus) {
  if (status === "SUBMITTED") return "TRANSFER_SUBMISSION";
  if (status === "APPROVED") return "TRANSFER_APPROVAL";
  if (status === "REJECTED") return "TRANSFER_REJECTION";
  return "TRANSFER_UPDATE";
}
