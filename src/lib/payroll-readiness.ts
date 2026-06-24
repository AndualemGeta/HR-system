import { Prisma } from "@prisma/client";
import type { EmployeeRoleValue } from "@/lib/constants";
import { payrollReadinessStatus, validatePayrollEmployee, type Phase4Issue } from "@/lib/phase4-validation";

export type PayrollEmployeeInput = {
  id: string;
  employeeId: string;
  fullName: string;
  employmentType: string | null;
  employmentStatus: string;
  currentRole: EmployeeRoleValue;
  currentLevel: string;
  currentDivisionId: string | null;
  currentDepartmentId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
  basicSalary: Prisma.Decimal | null;
  salaryEffectiveDate: Date | null;
  assignments: Array<{ id: string; endDate: Date | null }>;
};

export function buildPayrollRow(employee: PayrollEmployeeInput, locationNames = new Map<string, string>(), departmentNames = new Map<string, string>()) {
  const issues = validatePayrollEmployee({
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    employmentType: employee.employmentType,
    employmentStatus: employee.employmentStatus,
    currentRole: employee.currentRole,
    currentRegionId: employee.currentRegionId,
    currentShopId: employee.currentShopId,
    currentClusterId: employee.currentClusterId,
    directManagerId: employee.directManagerId,
    activeAssignmentCount: employee.assignments.filter((assignment) => assignment.endDate === null).length,
    basicSalary: employee.basicSalary,
    salaryEffectiveDate: employee.salaryEffectiveDate,
    salaryOptionalForCommission: true
  });
  const status = payrollReadinessStatus(issues);

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeId,
    fullName: employee.fullName,
    employmentType: employee.employmentType,
    division: label(employee.currentDivisionId, locationNames),
    department: label(employee.currentDepartmentId, departmentNames),
    region: label(employee.currentRegionId, locationNames),
    shop: label(employee.currentShopId, locationNames),
    cluster: label(employee.currentClusterId, locationNames),
    role: employee.currentRole,
    level: employee.currentLevel,
    basicSalary: employee.basicSalary,
    salaryEffectiveDate: employee.salaryEffectiveDate,
    employmentStatus: employee.employmentStatus,
    readinessStatus: status,
    validationIssues: issues as unknown as Prisma.InputJsonValue,
    includedInExport: status !== "BLOCKED"
  };
}

export function summarizePayrollRows(rows: Array<{ readinessStatus: "READY" | "WARNING" | "BLOCKED" }>) {
  return {
    totalEmployees: rows.length,
    readyCount: rows.filter((row) => row.readinessStatus === "READY").length,
    warningCount: rows.filter((row) => row.readinessStatus === "WARNING").length,
    blockedCount: rows.filter((row) => row.readinessStatus === "BLOCKED").length
  };
}

export function issuesForExport(row: { validationIssues: unknown }): Phase4Issue[] {
  return Array.isArray(row.validationIssues) ? (row.validationIssues as Phase4Issue[]) : [];
}

function label(id: string | null, names: Map<string, string>) {
  return id ? names.get(id) ?? id : null;
}
