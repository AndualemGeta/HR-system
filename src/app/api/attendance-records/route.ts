import { ApprovalStatus, AttendanceSource, AttendanceStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { employeeToScope } from "@/lib/phase4-access";
import { canViewAttendanceForEmployee } from "@/lib/phase5-access";
import { isPayrollPeriodLocked, validateAttendanceRecord } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  employeeId: z.string().min(1),
  attendanceDate: z.string().min(1),
  status: z.nativeEnum(AttendanceStatus),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  hoursWorked: z.coerce.number().optional().nullable(),
  overtimeHours: z.coerce.number().optional().nullable(),
  source: z.nativeEnum(AttendanceSource).default("MANUAL"),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("DRAFT"),
  notes: z.string().optional().nullable()
});

export async function GET() {
  const principal = await requirePermission("attendance.view");
  if (isApiError(principal)) return principal;
  const records = await prisma.attendanceRecord.findMany({ orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }], take: 500 });
  const employees = await prisma.employee.findMany({ where: { id: { in: records.map((record) => record.employeeId) } } });
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  return NextResponse.json({
    records: records.filter((record) => {
      const employee = employeeMap.get(record.employeeId);
      return employee ? canViewAttendanceForEmployee(principal, employeeToScope(employee)) : false;
    })
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("attendance.create");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attendance record.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateAttendanceRecord(parsed.data);
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const attendanceDate = new Date(parsed.data.attendanceDate);
  const locks = await prisma.payrollPeriodLock.findMany({ where: { lockStatus: "LOCKED" } });
  if (isPayrollPeriodLocked(locks, attendanceDate, attendanceDate)) {
    return NextResponse.json({ error: "Attendance falls in a locked payroll period. Create a payroll adjustment instead." }, { status: 423 });
  }
  const employee = await prisma.employee.findFirst({ where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canViewAttendanceForEmployee(principal, employeeToScope(employee))) return NextResponse.json({ error: "Employee is outside your attendance scope." }, { status: 403 });
  const record = await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id,
      attendanceDate,
      status: parsed.data.status,
      checkInTime: parsed.data.checkInTime ? new Date(parsed.data.checkInTime) : null,
      checkOutTime: parsed.data.checkOutTime ? new Date(parsed.data.checkOutTime) : null,
      hoursWorked: parsed.data.hoursWorked == null ? null : new Prisma.Decimal(parsed.data.hoursWorked),
      overtimeHours: parsed.data.overtimeHours == null ? null : new Prisma.Decimal(parsed.data.overtimeHours),
      source: parsed.data.source,
      approvalStatus: parsed.data.approvalStatus,
      recordedById: principal.id,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      notes: parsed.data.notes
    }
  });
  await writeAuditLog({ userId: principal.id, action: parsed.data.approvalStatus === "APPROVED" ? "ATTENDANCE_APPROVAL" : "ATTENDANCE_CREATE", entityType: "AttendanceRecord", entityId: record.id, newValue: record });
  return NextResponse.json({ record }, { status: 201 });
}
