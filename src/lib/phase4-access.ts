import { canViewEmployee, canViewSalary, hasAnySystemRole, hasPermission, type EmployeeScope, type Principal } from "@/lib/rbac";

export function canViewPayrollPreparation(principal: Principal): boolean {
  return hasPermission(principal, "payroll_preparation.view") && canViewSalary(principal) && hasAnySystemRole(principal, [
    "SUPER_ADMIN",
    "HR_ADMIN",
    "FINANCE_DIRECTOR",
    "FINANCE_PAYROLL"
  ]);
}

export function canExportPayroll(principal: Principal): boolean {
  return hasPermission(principal, "payroll_preparation.export") && canViewSalary(principal);
}

export function canViewKpiForEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "kpi.view")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "AUDITOR"])) return true;
  return canViewEmployee(principal, employee);
}

export function canViewComplianceForEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "compliance.view")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "CEO", "AUDITOR"])) return true;
  return canViewEmployee(principal, employee);
}

export function canViewDataQualityIssue(principal: Principal, employee?: EmployeeScope | null): boolean {
  if (!hasPermission(principal, "data_quality.view")) return false;
  if (!employee) return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "AUDITOR"]);
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "AUDITOR"])) return true;
  return canViewEmployee(principal, employee);
}

export function canViewSystemSetting(principal: Principal, isSensitive: boolean): boolean {
  if (!hasPermission(principal, "system_settings.view")) return false;
  if (!isSensitive) return true;
  return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"]);
}

export function employeeToScope(employee: {
  id: string;
  currentRole: EmployeeScope["currentRole"];
  currentDepartmentId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
}): EmployeeScope {
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
