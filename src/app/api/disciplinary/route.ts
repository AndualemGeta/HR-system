import { DisciplinaryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { disciplinaryIncidentTypes, warningLevels } from "@/lib/constants";
import { submitApprovalRequest } from "@/lib/approvals";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { validateDisciplinarySubmission } from "@/lib/phase3-validation";
import { employeeToScope } from "@/lib/phase2-access";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const disciplinarySchema = z.object({
  employeeId: z.string().min(1),
  incidentType: z.enum(disciplinaryIncidentTypes),
  incidentDate: z.string().min(1),
  description: z.string().min(1),
  actionTaken: z.string().optional().nullable(),
  warningLevel: z.enum(warningLevels).optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  attachmentPath: z.string().optional().nullable(),
  status: z.nativeEnum(DisciplinaryStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("disciplinary.view");
  if (isApiError(principal)) return principal;

  const records = await prisma.disciplinaryRecord.findMany({
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
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({
    records: records.filter((record) =>
      canViewLifecycleRecord(principal, employeeToScope(record.employee), "disciplinary.view")
    )
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("disciplinary.create");
  if (isApiError(principal)) return principal;

  const parsed = disciplinarySchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid disciplinary record.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canCreateLifecycleRecord(principal, employeeToScope(employee), "disciplinary.create")) {
    return NextResponse.json({ error: "Employee is outside your disciplinary scope." }, { status: 403 });
  }

  if (parsed.data.status === "SUBMITTED") {
    const issues = validateDisciplinarySubmission(parsed.data);
    if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }

  const record = await prisma.disciplinaryRecord.create({
    data: {
      employeeId: employee.id,
      incidentType: parsed.data.incidentType,
      incidentDate: new Date(parsed.data.incidentDate),
      description: parsed.data.description,
      actionTaken: parsed.data.actionTaken,
      warningLevel: parsed.data.warningLevel,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
      attachmentPath: parsed.data.attachmentPath,
      issuedById: principal.id,
      status: parsed.data.status
    },
    include: { employee: true }
  });

  if (record.status === "SUBMITTED") {
    await submitApprovalRequest({
      workflowType: "DISCIPLINARY",
      entityType: "DisciplinaryRecord",
      entityId: record.id,
      requestedById: principal.id
    });
  }

  await writeAuditLog({
    userId: principal.id,
    action: record.status === "SUBMITTED" ? "DISCIPLINARY_SUBMISSION" : "DISCIPLINARY_CREATE",
    entityType: "DisciplinaryRecord",
    entityId: record.id,
    newValue: record
  });

  return NextResponse.json({ record }, { status: 201 });
}
