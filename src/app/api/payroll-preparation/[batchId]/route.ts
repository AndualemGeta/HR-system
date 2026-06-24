import { PayrollBatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewPayrollPreparation } from "@/lib/phase4-access";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

const updateSchema = z.object({
  status: z.nativeEnum(PayrollBatchStatus).optional(),
  rowId: z.string().optional().nullable(),
  includedInExport: z.coerce.boolean().optional(),
  notes: z.string().optional().nullable()
});

export async function GET(_request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_preparation.view");
  if (isApiError(principal)) return principal;
  if (!canViewPayrollPreparation(principal)) {
    return NextResponse.json({ error: "Permission denied for payroll preparation." }, { status: 403 });
  }

  const { batchId } = await context.params;
  const batch = await prisma.payrollPreparationBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: [{ readinessStatus: "asc" }, { employeeCode: "asc" }] } }
  });
  if (!batch) return NextResponse.json({ error: "Payroll batch not found." }, { status: 404 });

  return NextResponse.json({ batch });
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_preparation.validate");
  if (isApiError(principal)) return principal;
  if (!canViewPayrollPreparation(principal)) {
    return NextResponse.json({ error: "Permission denied for payroll preparation." }, { status: 403 });
  }

  const { batchId } = await context.params;
  const parsed = updateSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payroll update.", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.rowId) {
    const row = await prisma.payrollPreparationRow.findUnique({ where: { id: parsed.data.rowId } });
    if (!row || row.batchId !== batchId) return NextResponse.json({ error: "Payroll row not found." }, { status: 404 });
    if (row.readinessStatus === "BLOCKED" && parsed.data.includedInExport) {
      return NextResponse.json({ error: "Blocked payroll rows cannot be included in export." }, { status: 422 });
    }

    const updatedRow = await prisma.payrollPreparationRow.update({
      where: { id: row.id },
      data: { includedInExport: parsed.data.includedInExport ?? row.includedInExport }
    });

    await writeAuditLog({
      userId: principal.id,
      action: "PAYROLL_ROW_UPDATE",
      entityType: "PayrollPreparationRow",
      entityId: updatedRow.id,
      oldValue: { includedInExport: row.includedInExport },
      newValue: { includedInExport: updatedRow.includedInExport }
    });

    return NextResponse.json({ row: updatedRow });
  }

  if (!parsed.data.status && parsed.data.notes === undefined) {
    return NextResponse.json({ error: "No payroll update was provided." }, { status: 400 });
  }

  const batch = await prisma.payrollPreparationBatch.findUnique({
    where: { id: batchId },
    include: { rows: true }
  });
  if (!batch) return NextResponse.json({ error: "Payroll batch not found." }, { status: 404 });

  const nextStatus = parsed.data.status ?? batch.status;
  if (nextStatus === "APPROVED" && !hasPermission(principal, "payroll_preparation.approve")) {
    return NextResponse.json({ error: "Approval permission is required." }, { status: 403 });
  }

  if (nextStatus === "APPROVED") {
    const includedBlockedRows = batch.rows.filter((row) => row.readinessStatus === "BLOCKED" && row.includedInExport);
    if (includedBlockedRows.length > 0) {
      return NextResponse.json({ error: "Resolve or exclude blocked payroll rows before approval." }, { status: 422 });
    }
    const openBlockers = await prisma.payrollValidationIssue.count({
      where: { payrollBatchId: batch.id, severity: "BLOCKER", status: { notIn: ["RESOLVED", "DISMISSED"] } }
    });
    if (openBlockers > 0) {
      return NextResponse.json({ error: "Resolve payroll blocker issues before approval." }, { status: 422 });
    }
  }

  const updatedBatch = await prisma.payrollPreparationBatch.update({
    where: { id: batch.id },
    data: {
      status: nextStatus,
      notes: parsed.data.notes ?? batch.notes,
      reviewedById: ["UNDER_REVIEW", "APPROVED"].includes(nextStatus) ? principal.id : batch.reviewedById,
      approvedById: nextStatus === "APPROVED" ? principal.id : batch.approvedById
    },
    include: { rows: { orderBy: { employeeCode: "asc" } } }
  });

  await writeAuditLog({
    userId: principal.id,
    action: nextStatus === "APPROVED" ? "PAYROLL_BATCH_APPROVAL" : "PAYROLL_BATCH_UPDATE",
    entityType: "PayrollPreparationBatch",
    entityId: updatedBatch.id,
    oldValue: { status: batch.status, notes: batch.notes },
    newValue: { status: updatedBatch.status, notes: updatedBatch.notes }
  });

  return NextResponse.json({ batch: updatedBatch });
}
