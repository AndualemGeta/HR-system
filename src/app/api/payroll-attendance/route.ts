import { ApprovalStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewPayrollInput, employeeToScope } from "@/lib/phase45-access";
import { validateAttendanceInput } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const attendanceSchema = z.object({
  employeeId: z.string().min(1),
  payrollPeriodStart: z.string().min(1),
  payrollPeriodEnd: z.string().min(1),
  workingDays: z.coerce.number(),
  daysPresent: z.coerce.number().default(0),
  daysAbsent: z.coerce.number().default(0),
  paidLeaveDays: z.coerce.number().default(0),
  unpaidLeaveDays: z.coerce.number().default(0),
  sundayOvertimeHours: z.coerce.number().default(0),
  holidayOvertimeHours: z.coerce.number().default(0),
  nightOvertimeHours: z.coerce.number().default(0),
  attendanceSource: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  notes: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("payroll_attendance.view");
  if (isApiError(principal)) return principal;
  const inputs = await prisma.payrollAttendanceInput.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ inputs: inputs.filter((input) => canViewPayrollInput(principal, employeeToScope(input.employee))) });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_attendance.create");
  if (isApiError(principal)) return principal;
  const parsed = attendanceSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll attendance input.", details: parsed.error.flatten() }, { status: 400 });
  const employee = await prisma.employee.findFirst({ where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canViewPayrollInput(principal, employeeToScope(employee))) return NextResponse.json({ error: "Employee is outside your payroll scope." }, { status: 403 });
  const issues = validateAttendanceInput(parsed.data);
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const input = await prisma.payrollAttendanceInput.create({
    data: {
      ...parsed.data,
      employeeId: employee.id,
      payrollPeriodStart: new Date(parsed.data.payrollPeriodStart),
      payrollPeriodEnd: new Date(parsed.data.payrollPeriodEnd),
      workingDays: new Prisma.Decimal(parsed.data.workingDays),
      daysPresent: new Prisma.Decimal(parsed.data.daysPresent),
      daysAbsent: new Prisma.Decimal(parsed.data.daysAbsent),
      paidLeaveDays: new Prisma.Decimal(parsed.data.paidLeaveDays),
      unpaidLeaveDays: new Prisma.Decimal(parsed.data.unpaidLeaveDays),
      sundayOvertimeHours: new Prisma.Decimal(parsed.data.sundayOvertimeHours),
      holidayOvertimeHours: new Prisma.Decimal(parsed.data.holidayOvertimeHours),
      nightOvertimeHours: new Prisma.Decimal(parsed.data.nightOvertimeHours),
      uploadedById: principal.id,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null
    }
  });
  await writeAuditLog({ userId: principal.id, action: "PAYROLL_ATTENDANCE_CREATE", entityType: "PayrollAttendanceInput", entityId: input.id, newValue: input });
  return NextResponse.json({ input }, { status: 201 });
}
