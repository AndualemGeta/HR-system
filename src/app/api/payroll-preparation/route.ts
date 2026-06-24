import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { buildPayrollRow, summarizePayrollRows } from "@/lib/payroll-readiness";
import { canViewPayrollPreparation } from "@/lib/phase4-access";
import { validatePayrollPeriod } from "@/lib/phase4-validation";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const batchSchema = z.object({
  batchName: z.string().optional().nullable(),
  payrollPeriodStart: z.string().min(1),
  payrollPeriodEnd: z.string().min(1),
  notes: z.string().optional().nullable()
});

export async function GET() {
  const principal = await requirePermission("payroll_preparation.view");
  if (isApiError(principal)) return principal;
  if (!canViewPayrollPreparation(principal)) {
    return NextResponse.json({ error: "Permission denied for payroll preparation." }, { status: 403 });
  }

  const batches = await prisma.payrollPreparationBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_preparation.create");
  if (isApiError(principal)) return principal;
  if (!canViewPayrollPreparation(principal)) {
    return NextResponse.json({ error: "Permission denied for payroll preparation." }, { status: 403 });
  }

  const parsed = batchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payroll batch.", details: parsed.error.flatten() }, { status: 400 });
  }

  const periodIssues = validatePayrollPeriod({
    start: parsed.data.payrollPeriodStart,
    end: parsed.data.payrollPeriodEnd
  });
  if (periodIssues.length > 0) return NextResponse.json({ error: periodIssues[0].message, issues: periodIssues }, { status: 422 });

  const [employees, locations, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { employmentStatus: { in: ["ACTIVE", "ON_PROBATION"] } },
      include: { assignments: { where: { endDate: null }, select: { id: true, endDate: true } } },
      orderBy: { employeeId: "asc" },
      take: 3000
    }),
    prisma.location.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true } })
  ]);

  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const rows = employees.map((employee) => buildPayrollRow(employee, locationNames, departmentNames));
  const summary = summarizePayrollRows(rows);
  const start = new Date(parsed.data.payrollPeriodStart);
  const end = new Date(parsed.data.payrollPeriodEnd);

  const batch = await prisma.payrollPreparationBatch.create({
    data: {
      batchName: parsed.data.batchName || `Payroll ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
      payrollPeriodStart: start,
      payrollPeriodEnd: end,
      createdById: principal.id,
      status: "VALIDATED",
      notes: parsed.data.notes,
      ...summary,
      rows: { createMany: { data: rows } }
    },
    include: { rows: { orderBy: { employeeCode: "asc" } } }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "PAYROLL_BATCH_CREATE",
    entityType: "PayrollPreparationBatch",
    entityId: batch.id,
    newValue: {
      batchName: batch.batchName,
      payrollPeriodStart: batch.payrollPeriodStart,
      payrollPeriodEnd: batch.payrollPeriodEnd,
      totalEmployees: batch.totalEmployees
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "PAYROLL_VALIDATION",
    entityType: "PayrollPreparationBatch",
    entityId: batch.id,
    newValue: summary
  });

  return NextResponse.json({ batch }, { status: 201 });
}
