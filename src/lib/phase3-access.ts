import type { EmployeeRole } from "@prisma/client";
import { canViewEmployee, canViewSalary, hasAnySystemRole, hasPermission, type EmployeeScope, type Principal } from "@/lib/rbac";

export type Phase3EmployeeScope = EmployeeScope & {
  currentRole: EmployeeRole;
};

export function canViewLifecycleRecord(principal: Principal, employee: EmployeeScope, permission: Parameters<typeof hasPermission>[1]): boolean {
  if (!hasPermission(principal, permission)) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "CEO", "AUDITOR"])) return true;
  return canViewEmployee(principal, employee);
}

export function canCreateLifecycleRecord(principal: Principal, employee: EmployeeScope, permission: Parameters<typeof hasPermission>[1]): boolean {
  if (!hasPermission(principal, permission)) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "HR_OFFICER"])) return true;
  return canViewEmployee(principal, employee);
}

export function canApproveLifecycleRecord(principal: Principal, permission: Parameters<typeof hasPermission>[1]): boolean {
  if (!hasPermission(principal, permission)) return false;
  return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "CEO"]);
}

export function canCompleteExit(principal: Principal): boolean {
  return hasPermission(principal, "termination.complete_exit") && hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"]);
}

export function canUpdateFinalPayment(principal: Principal): boolean {
  return hasPermission(principal, "termination.update_final_payment") && canViewSalary(principal);
}

export function canViewPromotionSalary(principal: Principal): boolean {
  return canViewSalary(principal);
}
