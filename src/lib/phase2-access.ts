import type { DocumentVisibility, EmployeeRole } from "@prisma/client";
import {
  canViewEmployee,
  canViewSalary,
  hasAnySystemRole,
  hasPermission,
  type EmployeeScope,
  type Principal
} from "@/lib/rbac";

type DocumentScope = {
  employeeId: string;
  visibilityLevel: DocumentVisibility;
  employee?: EmployeeScope | null;
};

export function canViewDocument(principal: Principal, document: DocumentScope): boolean {
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"])) return true;

  if (document.visibilityLevel === "SALARY_RESTRICTED") {
    return canViewSalary(principal);
  }

  if (["SENSITIVE_HR_ONLY", "HR_ONLY", "CONFIDENTIAL"].includes(document.visibilityLevel)) {
    return hasAnySystemRole(principal, ["HR_MANAGER", "HR_OFFICER"]);
  }

  if (document.visibilityLevel === "EMPLOYEE_VISIBLE" && principal.employeeId === document.employeeId) {
    return true;
  }

  if (document.visibilityLevel === "MANAGER_VISIBLE" && document.employee) {
    return canViewEmployee(principal, document.employee);
  }

  return hasPermission(principal, "document.view") && Boolean(document.employee && canViewEmployee(principal, document.employee));
}

export function canUploadDocument(principal: Principal, visibilityLevel: DocumentVisibility): boolean {
  if (!hasPermission(principal, "document.upload")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"])) return true;
  if (visibilityLevel === "SALARY_RESTRICTED") return false;
  if (["SENSITIVE_HR_ONLY", "CONFIDENTIAL"].includes(visibilityLevel)) {
    return hasAnySystemRole(principal, ["HR_MANAGER"]);
  }
  return hasAnySystemRole(principal, ["HR_MANAGER", "HR_OFFICER"]);
}

export function canViewScopedEmployee(principal: Principal, employee: EmployeeScope): boolean {
  return canViewEmployee(principal, employee);
}

export function canManageLeave(principal: Principal): boolean {
  return hasPermission(principal, "leave.update") || hasPermission(principal, "leave.approve");
}

export function canCreateAchievementFor(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "achievement.create")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER"])) return true;
  return canViewEmployee(principal, employee);
}

export function canApproveAchievement(principal: Principal): boolean {
  return hasPermission(principal, "achievement.approve");
}

export function employeeToScope(employee: {
  id: string;
  currentRole: EmployeeRole;
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
