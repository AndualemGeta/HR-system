import {
  rolePermissions,
  type EmployeeRoleValue,
  type PermissionKey,
  type SystemRoleValue
} from "./constants";

export type Principal = {
  id: string;
  employeeId?: string | null;
  systemRoles: SystemRoleValue[];
  employeeRole?: EmployeeRoleValue | null;
  departmentIds?: string[];
  regionIds?: string[];
  shopIds?: string[];
  clusterIds?: string[];
  directReportIds?: string[];
};

export type EmployeeScope = {
  id: string;
  currentRole: EmployeeRoleValue;
  currentDepartmentId?: string | null;
  currentRegionId?: string | null;
  currentShopId?: string | null;
  currentClusterId?: string | null;
  directManagerId?: string | null;
};

export function permissionsForRoles(roles: SystemRoleValue[]): Set<PermissionKey> {
  return new Set(roles.flatMap((role) => rolePermissions[role] ?? []));
}

export function hasPermission(principal: Principal, permission: PermissionKey): boolean {
  return permissionsForRoles(principal.systemRoles).has(permission);
}

export function hasAnySystemRole(principal: Principal, roles: SystemRoleValue[]): boolean {
  return principal.systemRoles.some((role) => roles.includes(role));
}

export function canViewSalary(principal: Principal): boolean {
  return hasAnySystemRole(principal, [
    "SUPER_ADMIN",
    "HR_ADMIN",
    "FINANCE_PAYROLL",
    "FINANCE_DIRECTOR"
  ]);
}

export function canUpdateSalary(principal: Principal): boolean {
  return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"]);
}

export function canViewEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "CEO", "HR_ADMIN", "HR_MANAGER", "AUDITOR"])) {
    return true;
  }

  if (principal.employeeId && principal.employeeId === employee.id) {
    return true;
  }

  if (principal.directReportIds?.includes(employee.id)) {
    return true;
  }

  return isWithinReportingScope(principal, employee);
}

export function canEvaluateEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "evaluation.create")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "CEO", "HR_ADMIN", "HR_MANAGER"])) return true;
  if (principal.employeeId && principal.employeeId === employee.id) return false;
  if (principal.directReportIds?.includes(employee.id)) return true;

  if (principal.systemRoles.includes("SALES_HEAD")) {
    return [
      "AREA_SALES_MANAGER",
      "SHOP_MANAGER",
      "SHOP_ACCOUNTANT",
      "DSA",
      "DSP",
      "BA_COORDINATOR",
      "CLEANING_STAFF",
      "SECURITY_STAFF",
      "EBU_SUPERVISOR",
      "EBU_FTTH_SUPERVISOR",
      "EBU_TECHNICAL_SALES_LEAD",
      "EBU_FTTH_SALES"
    ].includes(employee.currentRole);
  }

  if (principal.systemRoles.includes("FINANCE_DIRECTOR")) {
    return [
      "TREASURY_MANAGER",
      "ACCOUNTANT",
      "FINANCIAL_CONTROL_REPORTING_MANAGER",
      "SHOP_ACCOUNTANT",
      "SHOP_MANAGER"
    ].includes(employee.currentRole);
  }

  if (principal.systemRoles.includes("TREASURY_MANAGER")) {
    return employee.currentRole === "ACCOUNTANT";
  }

  if (principal.systemRoles.includes("DISTRIBUTION_MANAGER")) {
    return ["DISTRIBUTION_OFFICER", "SHOP_MANAGER"].includes(employee.currentRole);
  }

  if (principal.systemRoles.includes("TECHNOLOGY_MANAGER")) {
    return employee.currentRole === "TECHNOLOGY_MANAGER" || isWithinReportingScope(principal, employee);
  }

  return isWithinReportingScope(principal, employee);
}

function isWithinReportingScope(principal: Principal, employee: EmployeeScope): boolean {
  if (employee.currentShopId && principal.shopIds?.includes(employee.currentShopId)) {
    return true;
  }

  if (employee.currentClusterId && principal.clusterIds?.includes(employee.currentClusterId)) {
    return true;
  }

  if (employee.currentRegionId && principal.regionIds?.includes(employee.currentRegionId)) {
    return true;
  }

  if (employee.currentDepartmentId && principal.departmentIds?.includes(employee.currentDepartmentId)) {
    return true;
  }

  return false;
}
