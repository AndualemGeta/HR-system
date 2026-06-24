import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { toCsv, toXlsx } from "@/lib/export";
import { getPhase3Reports } from "@/lib/phase3-reports";
import { canViewEmployee, canViewSalary } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ kind: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const principal = await requirePermission("export.create");
  if (isApiError(principal)) return principal;

  const { kind } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const rows = await rowsForExport(kind, principal);
  if (!rows) return NextResponse.json({ error: "Unsupported export kind." }, { status: 404 });

  await writeAuditLog({
    userId: principal.id,
    action: "EXPORT_CREATE",
    entityType: "Export",
    entityId: kind,
    newValue: { kind, format, rowCount: rows.length }
  });
  await prisma.exportHistory.create({
    data: {
      exportType: kind,
      format,
      rowCount: rows.length,
      fileName: `${kind}.${format}`,
      createdById: principal.id,
      metadata: { source: "generic-export-api" }
    }
  });

  if (format === "xlsx") {
    const buffer = await toXlsx(rows, kind.slice(0, 28) || "Export");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${kind}.xlsx"`
      }
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${kind}.csv"`
    }
  });
}

async function rowsForExport(kind: string, principal: Parameters<typeof canViewSalary>[0]): Promise<Array<Record<string, unknown>> | null> {
  if (kind === "employees") {
    const employees = await prisma.employee.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    return employees
      .filter((employee) =>
        canViewEmployee(principal, {
          id: employee.id,
          currentRole: employee.currentRole,
          currentDepartmentId: employee.currentDepartmentId,
          currentRegionId: employee.currentRegionId,
          currentShopId: employee.currentShopId,
          currentClusterId: employee.currentClusterId,
          directManagerId: employee.directManagerId
        })
      )
      .map((employee) => ({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        role: employee.currentRole,
        status: employee.employmentStatus,
        departmentId: employee.currentDepartmentId,
        shopId: employee.currentShopId,
        ...(canViewSalary(principal) ? { basicSalary: employee.basicSalary?.toString() ?? "" } : {})
      }));
  }

  if (kind === "disciplinary") {
    const records = await prisma.disciplinaryRecord.findMany({ include: { employee: true }, take: 1000 });
    return records
      .filter((record) => canViewEmployee(principal, employeeScope(record.employee)))
      .map((record) => ({
        employeeId: record.employee.employeeId,
        employee: record.employee.fullName,
        incidentType: record.incidentType,
        warningLevel: record.warningLevel ?? "",
        status: record.status,
        incidentDate: record.incidentDate.toISOString().slice(0, 10)
      }));
  }

  if (kind === "terminations") {
    const records = await prisma.terminationCase.findMany({ include: { employee: true }, take: 1000 });
    return records
      .filter((record) => canViewEmployee(principal, employeeScope(record.employee)))
      .map((record) => ({
        employeeId: record.employee.employeeId,
        employee: record.employee.fullName,
        terminationType: record.terminationType,
        status: record.status,
        clearanceStatus: record.clearanceStatus,
        finalPaymentStatus: canViewSalary(principal) ? record.finalPaymentStatus : "REDACTED"
      }));
  }

  if (kind === "transfers") {
    const records = await prisma.transferRequest.findMany({ include: { employee: true }, take: 1000 });
    return records
      .filter((record) => canViewEmployee(principal, employeeScope(record.employee)))
      .map((record) => ({
        employeeId: record.employee.employeeId,
        employee: record.employee.fullName,
        requestedRole: record.requestedRole ?? "",
        requestedLevel: record.requestedLevel ?? "",
        status: record.status,
        effectiveDate: record.effectiveDate?.toISOString().slice(0, 10) ?? ""
      }));
  }

  if (kind === "promotions") {
    const records = await prisma.promotionRequest.findMany({ include: { employee: true }, take: 1000 });
    return records
      .filter((record) => canViewEmployee(principal, employeeScope(record.employee)))
      .map((record) => ({
        employeeId: record.employee.employeeId,
        employee: record.employee.fullName,
        proposedRole: record.proposedRole ?? "",
        proposedLevel: record.proposedLevel ?? "",
        proposedSalary: canViewSalary(principal) ? record.proposedSalary?.toString() ?? "" : "REDACTED",
        status: record.status,
        effectiveDate: record.effectiveDate?.toISOString().slice(0, 10) ?? ""
      }));
  }

  if (kind === "approvals") {
    const requests = await prisma.approvalRequest.findMany({ include: { workflow: true }, take: 1000 });
    return requests.map((request) => ({
      workflow: request.workflow.workflowType,
      entityType: request.entityType,
      entityId: request.entityId,
      status: request.status,
      currentStep: request.currentStep,
      createdAt: request.createdAt.toISOString()
    }));
  }

  if (kind === "advanced-reports") {
    const reports = await getPhase3Reports(principal);
    return Object.entries(reports).flatMap(([section, value]) =>
      Array.isArray(value)
        ? value.map((row) => ({
            section,
            label: "label" in row ? String(row.label) : section,
            value: "value" in row ? Number(row.value) : 0
          }))
        : [{ section, label: section, value: Number(value) }]
    );
  }

  return null;
}

function employeeScope(employee: {
  id: string;
  currentRole: Parameters<typeof canViewEmployee>[1]["currentRole"];
  currentDepartmentId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
}) {
  return {
    id: employee.id,
    currentRole: employee.currentRole,
    currentDepartmentId: employee.currentDepartmentId,
    currentRegionId: employee.currentRegionId,
    currentShopId: employee.currentShopId,
    currentClusterId: employee.currentClusterId,
    directManagerId: employee.directManagerId
  };
}
