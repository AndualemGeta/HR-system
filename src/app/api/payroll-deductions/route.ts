import { ApprovalStatus, DeductionType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewPayrollInput, employeeToScope } from "@/lib/phase45-access";
import { validateDeduction } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const deductionSchema = z.object({
  employeeId: z.string().min(1),
  payrollPeriodStart: z.string().min(1),
  payrollPeriodEnd: z.string().min(1),
  deductionType: z.nativeEnum(DeductionType),
  amount: z.coerce.number(),
  preTaxStatus: z.coerce.boolean().default(false),
  reason: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("payroll_deduction.view");
  if (isApiError(principal)) return principal;
  const deductions = await prisma.payrollDeduction.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ deductions: deductions.filter((deduction) => canViewPayrollInput(principal, employeeToScope(deduction.employee))) });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_deduction.create");
  if (isApiError(principal)) return principal;
  const parsed = deductionSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid deduction.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateDeduction(parsed.data);
  if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const employee = await prisma.employee.findFirst({ where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canViewPayrollInput(principal, employeeToScope(employee))) return NextResponse.json({ error: "Employee is outside your payroll scope." }, { status: 403 });
  const deduction = await prisma.payrollDeduction.create({
    data: {
      ...parsed.data,
      employeeId: employee.id,
      payrollPeriodStart: new Date(parsed.data.payrollPeriodStart),
      payrollPeriodEnd: new Date(parsed.data.payrollPeriodEnd),
      amount: new Prisma.Decimal(parsed.data.amount),
      createdById: principal.id,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null
    }
  });
  await writeAuditLog({ userId: principal.id, action: "PAYROLL_DEDUCTION_CREATE", entityType: "PayrollDeduction", entityId: deduction.id, newValue: deduction });
  return NextResponse.json({ deduction }, { status: 201 });
}
