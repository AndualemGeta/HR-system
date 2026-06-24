import { CommissionCalculationStatus, type EmployeeRole, type EmploymentType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { calculateCommission } from "@/lib/payroll-calculation";
import { isApprovedEffectivePayrollRule } from "@/lib/payroll-rule-governance";
import { canViewCommissionForEmployee, employeeToScope } from "@/lib/phase45-access";
import { validateCommissionCalculation } from "@/lib/phase45-validation";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const calculationSchema = z.object({
  employeeId: z.string().min(1),
  commissionPlanId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  salesAmount: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  targetAmount: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  manualAdjustment: z.coerce.number().default(0),
  manualAdjustmentReason: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  relatedEvaluationId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  notes: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  calculationStatus: z.nativeEnum(CommissionCalculationStatus).default("CALCULATED")
});

export async function GET() {
  const principal = await requirePermission("commission_calculation.view");
  if (isApiError(principal)) return principal;
  const calculations = await prisma.commissionCalculation.findMany({
    include: { employee: true, commissionPlan: true, relatedEvaluation: { select: { id: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 300
  });
  return NextResponse.json({ calculations: calculations.filter((calculation) => canViewCommissionForEmployee(principal, employeeToScope(calculation.employee))) });
}

export async function POST(request: Request) {
  const principal = await requirePermission("commission_calculation.create");
  if (isApiError(principal)) return principal;
  const parsed = calculationSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commission calculation.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.calculationStatus === "APPROVED" && !hasPermission(principal, "commission_calculation.approve")) {
    return NextResponse.json({ error: "Commission approval permission is required." }, { status: 403 });
  }
  const issues = validateCommissionCalculation(parsed.data);
  if (issues.some((issue) => issue.severity === "BLOCKER")) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] },
    include: { assignments: { where: { endDate: null }, take: 1 } }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!employee.employmentType) return NextResponse.json({ error: "Employee must have employment type before commission calculation." }, { status: 422 });
  if (employee.assignments.length === 0) return NextResponse.json({ error: "Employee must have an active assignment before commission calculation." }, { status: 422 });
  if (!canViewCommissionForEmployee(principal, employeeToScope(employee))) return NextResponse.json({ error: "Employee is outside your commission scope." }, { status: 403 });

  const plan = parsed.data.commissionPlanId
    ? await prisma.commissionPlan.findUnique({ where: { id: parsed.data.commissionPlanId } })
    : await findCommissionPlanForEmployee(employee, new Date(parsed.data.periodEnd));
  if (!plan || !isApprovedEffectivePayrollRule(plan, new Date(parsed.data.periodEnd))) {
    return NextResponse.json({ error: "No approved active commission plan was found for this employee. HR/Finance must approve commission rules before payroll use." }, { status: 422 });
  }

  const relatedEvaluation = parsed.data.relatedEvaluationId
    ? await prisma.employeeEvaluation.findUnique({ where: { id: parsed.data.relatedEvaluationId } })
    : null;
  if (relatedEvaluation && relatedEvaluation.status !== "APPROVED") {
    return NextResponse.json({ error: "Only approved evaluations can be linked to commission calculations." }, { status: 422 });
  }

  const result = calculateCommission({
    calculationType: plan.calculationType,
    salesAmount: parsed.data.salesAmount,
    targetAmount: parsed.data.targetAmount,
    rate: plan.rate?.toNumber() ?? null,
    fixedAmount: plan.fixedAmount?.toNumber() ?? null,
    capAmount: plan.capAmount?.toNumber() ?? null,
    manualAdjustment: parsed.data.manualAdjustment
  });

  const calculation = await prisma.commissionCalculation.create({
    data: {
      employeeId: employee.id,
      commissionPlanId: plan.id,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      salesAmount: parsed.data.salesAmount == null ? null : new Prisma.Decimal(parsed.data.salesAmount),
      targetAmount: parsed.data.targetAmount == null ? null : new Prisma.Decimal(parsed.data.targetAmount),
      achievementPercent: result.achievementPercent == null ? null : new Prisma.Decimal(result.achievementPercent),
      baseSalary: employee.basicSalary,
      calculatedCommission: new Prisma.Decimal(result.calculatedCommission),
      manualAdjustment: new Prisma.Decimal(parsed.data.manualAdjustment),
      manualAdjustmentReason: parsed.data.manualAdjustmentReason,
      finalCommission: new Prisma.Decimal(result.finalCommission),
      calculationStatus: parsed.data.calculationStatus,
      calculatedById: principal.id,
      approvedById: parsed.data.calculationStatus === "APPROVED" ? principal.id : null,
      relatedEvaluationId: parsed.data.relatedEvaluationId,
      notes: parsed.data.notes
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.manualAdjustment !== 0 ? "COMMISSION_MANUAL_ADJUSTMENT" : "COMMISSION_CALCULATION_RUN",
    entityType: "CommissionCalculation",
    entityId: calculation.id,
    newValue: { id: calculation.id, status: calculation.calculationStatus, finalCommission: "REDACTED" }
  });
  return NextResponse.json({ calculation }, { status: 201 });
}

async function findCommissionPlanForEmployee(
  employee: { currentRole: EmployeeRole; employmentType: EmploymentType | null; currentDepartmentId: string | null; currentDivisionId: string | null },
  onDate: Date
) {
  return prisma.commissionPlan.findFirst({
    where: {
      activeStatus: true,
      approvalStatus: "APPROVED",
      isSample: false,
      effectiveStartDate: { lte: onDate },
      OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: onDate } }],
      AND: [
        { OR: [{ applicableRole: null }, { applicableRole: employee.currentRole }] },
        { OR: [{ employmentType: null }, { employmentType: employee.employmentType }] },
        { OR: [{ applicableDepartmentId: null }, { applicableDepartmentId: employee.currentDepartmentId }] },
        { OR: [{ applicableDivisionId: null }, { applicableDivisionId: employee.currentDivisionId }] }
      ]
    },
    orderBy: { createdAt: "desc" }
  });
}
