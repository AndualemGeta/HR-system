import { KpiResultStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewKpiForEmployee, employeeToScope } from "@/lib/phase4-access";
import { calculateAchievementPercent, ratingFromAchievement, validateKpiResult } from "@/lib/phase4-validation";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const resultSchema = z.object({
  employeeId: z.string().min(1),
  metricId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  targetValue: z.preprocess(emptyToUndefined, z.coerce.number().optional().nullable()),
  actualValue: z.coerce.number(),
  source: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  approvalStatus: z.nativeEnum(KpiResultStatus).default("SUBMITTED")
});

const approvalSchema = z.object({
  resultId: z.string().min(1),
  approvalStatus: z.enum(["APPROVED", "REJECTED"])
});

export async function GET() {
  const principal = await requirePermission("kpi.view");
  if (isApiError(principal)) return principal;

  const results = await prisma.employeeKpiResult.findMany({
    include: { employee: true, metric: true },
    orderBy: { periodEnd: "desc" },
    take: 500
  });

  return NextResponse.json({
    results: results.filter((result) => canViewKpiForEmployee(principal, employeeToScope(result.employee)))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("kpi.import");
  if (isApiError(principal)) return principal;

  const parsed = resultSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid KPI result.", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.approvalStatus === "APPROVED" && !hasPermission(principal, "kpi.approve")) {
    return NextResponse.json({ error: "Approval permission is required." }, { status: 403 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canViewKpiForEmployee(principal, employeeToScope(employee))) {
    return NextResponse.json({ error: "Employee is outside your KPI scope." }, { status: 403 });
  }

  const metric = await prisma.kpiMetric.findUnique({ where: { id: parsed.data.metricId } });
  if (!metric || !metric.activeStatus) return NextResponse.json({ error: "Active KPI metric not found." }, { status: 404 });
  const issues = validateKpiResult(parsed.data);
  if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });

  const achievementPercent = calculateAchievementPercent(parsed.data.targetValue, parsed.data.actualValue);
  const result = await prisma.employeeKpiResult.create({
    data: {
      employeeId: employee.id,
      metricId: metric.id,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      targetValue: parsed.data.targetValue == null ? null : new Prisma.Decimal(parsed.data.targetValue),
      actualValue: new Prisma.Decimal(parsed.data.actualValue),
      achievementPercent: achievementPercent == null ? null : new Prisma.Decimal(achievementPercent),
      rating: ratingFromAchievement(achievementPercent),
      source: parsed.data.source,
      uploadedById: principal.id,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null,
      approvalStatus: parsed.data.approvalStatus
    },
    include: { employee: true, metric: true }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "KPI_RESULT_IMPORT",
    entityType: "EmployeeKpiResult",
    entityId: result.id,
    newValue: {
      employeeId: result.employee.employeeId,
      metric: result.metric.name,
      approvalStatus: result.approvalStatus,
      rating: result.rating
    }
  });

  return NextResponse.json({ result }, { status: 201 });
}

export async function PATCH(request: Request) {
  const principal = await requirePermission("kpi.approve");
  if (isApiError(principal)) return principal;

  const parsed = approvalSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid KPI approval.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.employeeKpiResult.findUnique({ where: { id: parsed.data.resultId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "KPI result not found." }, { status: 404 });
  if (!canViewKpiForEmployee(principal, employeeToScope(existing.employee))) {
    return NextResponse.json({ error: "KPI result is outside your scope." }, { status: 403 });
  }

  const result = await prisma.employeeKpiResult.update({
    where: { id: existing.id },
    data: {
      approvalStatus: parsed.data.approvalStatus,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : null
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "KPI_RESULT_APPROVAL",
    entityType: "EmployeeKpiResult",
    entityId: result.id,
    oldValue: { approvalStatus: existing.approvalStatus },
    newValue: { approvalStatus: result.approvalStatus }
  });

  return NextResponse.json({ result });
}
