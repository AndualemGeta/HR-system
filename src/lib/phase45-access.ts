import { canViewEmployee, canViewSalary, hasAnySystemRole, hasPermission, type EmployeeScope, type Principal } from "@/lib/rbac";

export function canViewRestrictedCompensation(principal: Principal): boolean {
  return canViewSalary(principal) || hasAnySystemRole(principal, ["SUPER_ADMIN"]);
}

export function canViewSalaryReviewForEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "salary_review.view")) return false;
  if (canViewRestrictedCompensation(principal)) return true;
  return canViewEmployee(principal, employee);
}

export function canManageSalaryReview(principal: Principal): boolean {
  return hasPermission(principal, "salary_review.approve") && canViewRestrictedCompensation(principal);
}

export function canViewCommissionForEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "commission_calculation.view")) return false;
  if (canViewRestrictedCompensation(principal) || hasAnySystemRole(principal, ["HR_ADMIN", "AUDITOR"])) return true;
  return canViewEmployee(principal, employee);
}

export function canManagePayrollConfiguration(principal: Principal): boolean {
  return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_DIRECTOR"]) &&
    (hasPermission(principal, "payroll_rule.update") || hasPermission(principal, "paye_tax.manage") || hasPermission(principal, "pension_rule.manage"));
}

export function canRunPayrollCalculation(principal: Principal): boolean {
  return hasPermission(principal, "payroll_calculation.run") && canViewRestrictedCompensation(principal);
}

export function canViewPayrollInput(principal: Principal, employee: EmployeeScope): boolean {
  if (canViewRestrictedCompensation(principal)) return true;
  return canViewEmployee(principal, employee);
}

export function redactMoney(value: unknown, principal: Principal): string | null {
  if (!canViewRestrictedCompensation(principal)) return "REDACTED";
  if (value == null) return null;
  return typeof value === "object" && "toString" in value ? value.toString() : String(value);
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
