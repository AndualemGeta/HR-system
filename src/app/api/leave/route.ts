import { ApprovalStatus, LeaveType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canViewScopedEmployee, employeeToScope } from "@/lib/phase2-access";
import { writeAuditLog } from "@/lib/audit";
import { calculateInclusiveDays } from "@/lib/phase2-utils";

export const runtime = "nodejs";

const leaveSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: z.nativeEnum(LeaveType),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional().nullable(),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("SUBMITTED")
});

export async function GET() {
  const principal = await requirePermission("leave.view");
  if (isApiError(principal)) return principal;

  const leaveRecords = await prisma.leaveRecord.findMany({
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
    orderBy: { startDate: "desc" },
    take: 100
  });

  return NextResponse.json({
    leaveRecords: leaveRecords.filter((record) => canViewScopedEmployee(principal, employeeToScope(record.employee)))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("leave.create");
  if (isApiError(principal)) return principal;

  const parsed = leaveSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid leave record.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return NextResponse.json({ error: "Leave end date cannot be before start date." }, { status: 422 });
  }

  const leaveRecord = await prisma.leaveRecord.create({
    data: {
      employeeId: employee.id,
      leaveType: parsed.data.leaveType,
      startDate,
      endDate,
      totalDays: calculateInclusiveDays(startDate, endDate),
      reason: parsed.data.reason,
      approvalStatus: parsed.data.approvalStatus,
      requestedById: principal.id
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "LEAVE_CREATE",
    entityType: "LeaveRecord",
    entityId: leaveRecord.id,
    newValue: leaveRecord
  });

  return NextResponse.json({ leaveRecord }, { status: 201 });
}

async function readRequestData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}
