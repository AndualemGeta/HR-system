import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { toCsv, toXlsx } from "@/lib/export";
import { canExportPayroll, canViewPayrollPreparation } from "@/lib/phase4-access";
import { canViewPayrollExportFields } from "@/lib/phase5-access";
import { templateUsesRestrictedFields } from "@/lib/phase5-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ batchId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_preparation.export");
  if (isApiError(principal)) return principal;
  if (!canViewPayrollPreparation(principal) || !canExportPayroll(principal)) {
    return NextResponse.json({ error: "Permission denied for payroll export." }, { status: 403 });
  }

  const { batchId } = await context.params;
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("templateId");
  const formatParam = searchParams.get("format");
  const format = formatParam === "xlsx" ? "xlsx" : formatParam === "json" ? "json" : "csv";
  const batch = await prisma.payrollPreparationBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: { employeeCode: "asc" } } }
  });
  if (!batch) return NextResponse.json({ error: "Payroll batch not found." }, { status: 404 });
  if (!["APPROVED", "EXPORTED"].includes(batch.status)) {
    return NextResponse.json({ error: "Payroll batch must be approved before export." }, { status: 422 });
  }
  const openBlockers = await prisma.payrollValidationIssue.count({
    where: { payrollBatchId: batch.id, severity: "BLOCKER", status: { notIn: ["RESOLVED", "DISMISSED"] } }
  });
  if (openBlockers > 0) {
    return NextResponse.json({ error: "Payroll batch has unresolved blocker issues and cannot be exported." }, { status: 422 });
  }
  const template = templateId
    ? await prisma.payrollExportTemplate.findUnique({ where: { id: templateId } })
    : null;
  if (template && !template.activeStatus) return NextResponse.json({ error: "Payroll export template is inactive." }, { status: 422 });
  const fieldMapping = template?.fieldMapping && typeof template.fieldMapping === "object" && !Array.isArray(template.fieldMapping)
    ? (template.fieldMapping as Record<string, string>)
    : null;
  if (fieldMapping && templateUsesRestrictedFields(fieldMapping) && !canViewPayrollExportFields(principal)) {
    return NextResponse.json({ error: "This export template maps restricted payroll fields." }, { status: 403 });
  }

  const baseRows = batch.rows
    .filter((row) => row.includedInExport && row.readinessStatus !== "BLOCKED")
    .map((row) => ({
      employeeId: row.employeeCode,
      fullName: row.fullName,
      employmentType: row.employmentType ?? "",
      role: row.role,
      level: row.level,
      department: row.department ?? "",
      region: row.region ?? "",
      shop: row.shop ?? "",
      cluster: row.cluster ?? "",
      basicSalary: row.basicSalary?.toString() ?? "",
      workingDays: row.workingDays?.toString() ?? "",
      daysPresent: row.daysPresent?.toString() ?? "",
      paidLeaveDays: row.paidLeaveDays?.toString() ?? "",
      unpaidLeaveDays: row.unpaidLeaveDays?.toString() ?? "",
      proratedBasicSalary: row.proratedBasicSalary?.toString() ?? "",
      approvedAllowances: row.approvedAllowances?.toString() ?? "",
      approvedCommission: row.approvedCommission?.toString() ?? "",
      overtimeAmount: row.overtimeAmount?.toString() ?? "",
      grossSalary: row.grossSalary?.toString() ?? "",
      employeePension: row.employeePension?.toString() ?? "",
      employerPension: row.employerPension?.toString() ?? "",
      taxableIncome: row.taxableIncome?.toString() ?? "",
      payeTax: row.payeTax?.toString() ?? "",
      approvedDeductions: row.approvedDeductions?.toString() ?? "",
      netSalary: row.netSalary?.toString() ?? "",
      employerTotalCost: row.employerTotalCost?.toString() ?? "",
      salaryEffectiveDate: row.salaryEffectiveDate?.toISOString().slice(0, 10) ?? "",
      readinessStatus: row.readinessStatus
    }));
  const rows = fieldMapping ? baseRows.map((row) => applyFieldMapping(row, fieldMapping)) : baseRows;
  const fileName = `payroll-preparation-${batch.payrollPeriodStart.toISOString().slice(0, 10)}.${format}`;

  await prisma.exportHistory.create({
    data: {
      exportType: "payroll-preparation",
      format,
      rowCount: rows.length,
      fileName,
      createdById: principal.id,
      metadata: {
        batchId: batch.id,
        templateId: template?.id ?? null,
        batchName: batch.batchName,
        payrollPeriodStart: batch.payrollPeriodStart,
        payrollPeriodEnd: batch.payrollPeriodEnd
      }
    }
  });

  await prisma.payrollPreparationBatch.update({ where: { id: batch.id }, data: { status: "EXPORTED" } });
  const exportRun = await prisma.payrollExportRun.create({
    data: {
      payrollBatchId: batch.id,
      templateId: template?.id ?? null,
      exportFormat: format.toUpperCase() as "CSV" | "XLSX" | "JSON",
      exportedById: principal.id,
      rowCount: rows.length,
      fileName,
      status: "DOWNLOADED",
      metadata: {
        templateName: template?.name ?? null,
        noPaymentTriggered: true
      }
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "PAYROLL_EXPORT_RUN_DOWNLOAD",
    entityType: "PayrollPreparationBatch",
    entityId: batch.id,
    newValue: { format, rowCount: rows.length, exportRunId: exportRun.id, noPaymentTriggered: true }
  });
  await writeAuditLog({
    userId: principal.id,
    action: "SALARY_DATA_ACCESS",
    entityType: "PayrollPreparationBatch",
    entityId: batch.id,
    newValue: { reason: "Payroll preparation export", rowCount: rows.length }
  });

  if (format === "xlsx") {
    const buffer = await toXlsx(rows, "Payroll Prep");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${fileName}"`
      }
    });
  }

  if (format === "json") {
    return NextResponse.json({ rows, metadata: { fileName, rowCount: rows.length, noPaymentTriggered: true } });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`
    }
  });
}

function applyFieldMapping(row: Record<string, unknown>, mapping: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(mapping).map(([internalField, exportField]) => [exportField, row[internalField] ?? ""])
  );
}
