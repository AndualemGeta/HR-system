import { canViewEmployee, canViewSalary, hasAnySystemRole, hasPermission, type EmployeeScope, type Principal } from "@/lib/rbac";

export function canManagePayrollLock(principal: Principal): boolean {
  return hasPermission(principal, "payroll_lock.manage") && hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_DIRECTOR", "FINANCE_PAYROLL"]);
}

export function canViewAttendanceForEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "attendance.view")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER"])) return true;
  return canViewEmployee(principal, employee);
}

export function canViewLeaveBalanceForEmployee(principal: Principal, employee: EmployeeScope): boolean {
  if (!hasPermission(principal, "leave_balance.view")) return false;
  if (hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "FINANCE_DIRECTOR", "FINANCE_PAYROLL"])) return true;
  return canViewEmployee(principal, employee);
}

export function canViewManagerDashboard(principal: Principal): boolean {
  return hasPermission(principal, "manager_dashboard.view") && Boolean(principal.directReportIds?.length || hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER"]));
}

export function canViewPayrollExportFields(principal: Principal): boolean {
  return canViewSalary(principal) && hasPermission(principal, "payroll_preparation.export");
}

export function canManageSecuritySettings(principal: Principal): boolean {
  return hasPermission(principal, "security_settings.manage") && hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"]);
}

export function canManageIntegrationTokens(principal: Principal): boolean {
  return hasPermission(principal, "integration_token.manage") && hasAnySystemRole(principal, ["SUPER_ADMIN"]);
}
