import { TerminationStatus, TerminationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { exitItems } from "@/lib/constants";
import { submitApprovalRequest } from "@/lib/approvals";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { validateTerminationApproval } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const terminationSchema = z.object({
  employeeId: z.string().min(1),
  terminationType: z.nativeEnum(TerminationType),
  reason: z.string().min(1),
  noticeDate: z.string().optional().nullable(),
  lastWorkingDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.nativeEnum(TerminationStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("termination.view");
  if (isApiError(principal)) return principal;

  const terminations = await prisma.terminationCase.findMany({
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
      exitItems: { orderBy: { key: "asc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({
    terminations: terminations.filter((termination) =>
      canViewLifecycleRecord(principal, employeeToScope(termination.employee), "termination.view")
    )
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("termination.create");
  if (isApiError(principal)) return principal;

  const parsed = terminationSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid termination case.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canCreateLifecycleRecord(principal, employeeToScope(employee), "termination.create")) {
    return NextResponse.json({ error: "Employee is outside your termination scope." }, { status: 403 });
  }

  if (parsed.data.status === "APPROVED") {
    const issues = validateTerminationApproval(parsed.data);
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const termination = await prisma.terminationCase.create({
    data: {
      employeeId: employee.id,
      terminationType: parsed.data.terminationType,
      reason: parsed.data.reason,
      noticeDate: parsed.data.noticeDate ? new Date(parsed.data.noticeDate) : null,
      lastWorkingDate: parsed.data.lastWorkingDate ? new Date(parsed.data.lastWorkingDate) : null,
      initiatedById: principal.id,
      notes: parsed.data.notes,
      status: parsed.data.status,
      approvalStatus: parsed.data.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT",
      exitItems: { create: exitItems.map(([key, label]) => ({ key, label })) }
    },
    include: { employee: true, exitItems: true }
  });

  if (termination.status === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "TERMINATION",
      entityType: "TerminationCase",
      entityId: termination.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: termination.status === "SUBMITTED" ? "TERMINATION_SUBMISSION" : "TERMINATION_CREATE",
    entityType: "TerminationCase",
    entityId: termination.id,
    newValue: termination
  });

  return NextResponse.json({ termination }, { status: 201 });
}
