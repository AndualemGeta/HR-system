import { EmployeeLevel, EmployeeRole, TransferRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { submitApprovalRequest } from "@/lib/approvals";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { validateTransferApproval } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const transferSchema = z.object({
  employeeId: z.string().min(1),
  requestedDivisionId: z.string().optional().nullable(),
  requestedDepartmentId: z.string().optional().nullable(),
  requestedRegionId: z.string().optional().nullable(),
  requestedShopId: z.string().optional().nullable(),
  requestedClusterId: z.string().optional().nullable(),
  requestedRole: z.nativeEnum(EmployeeRole).optional().nullable(),
  requestedLevel: z.nativeEnum(EmployeeLevel).optional().nullable(),
  requestedManagerId: z.string().optional().nullable(),
  reason: z.string().min(1),
  effectiveDate: z.string().optional().nullable(),
  status: z.nativeEnum(TransferRequestStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("transfer.view");
  if (isApiError(principal)) return principal;

  const transfers = await prisma.transferRequest.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({
    transfers: transfers.filter((transfer) =>
      canViewLifecycleRecord(principal, employeeToScope(transfer.employee), "transfer.view")
    )
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("transfer.create");
  if (isApiError(principal)) return principal;

  const parsed = transferSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canCreateLifecycleRecord(principal, employeeToScope(employee), "transfer.create")) {
    return NextResponse.json({ error: "Employee is outside your transfer scope." }, { status: 403 });
  }

  if (parsed.data.status === "APPROVED") {
    const issues = validateTransferApproval(parsed.data as never);
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const currentAssignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: employee.id, endDate: null },
    orderBy: { startDate: "desc" }
  });
  const transfer = await prisma.transferRequest.create({
    data: {
      employeeId: employee.id,
      currentAssignmentId: currentAssignment?.id,
      requestedDivisionId: parsed.data.requestedDivisionId,
      requestedDepartmentId: parsed.data.requestedDepartmentId,
      requestedRegionId: parsed.data.requestedRegionId,
      requestedShopId: parsed.data.requestedShopId,
      requestedClusterId: parsed.data.requestedClusterId,
      requestedRole: parsed.data.requestedRole,
      requestedLevel: parsed.data.requestedLevel,
      requestedManagerId: parsed.data.requestedManagerId,
      reason: parsed.data.reason,
      effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null,
      initiatedById: principal.id,
      status: parsed.data.status
    },
    include: { employee: true }
  });

  if (transfer.status === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "TRANSFER",
      entityType: "TransferRequest",
      entityId: transfer.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: transfer.status === "SUBMITTED" ? "TRANSFER_SUBMISSION" : "TRANSFER_CREATE",
    entityType: "TransferRequest",
    entityId: transfer.id,
    newValue: transfer
  });

  return NextResponse.json({ transfer }, { status: 201 });
}
