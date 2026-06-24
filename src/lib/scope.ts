import { canViewEmployee, type EmployeeScope, type Principal } from "@/lib/rbac";

export type EmployeeScopeRecord = {
  id: string;
  currentRole: EmployeeScope["currentRole"];
  currentDepartmentId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
};

export type EmployeeAccessCheck = (principal: Principal, employee: EmployeeScope) => boolean;

export const employeeScopeSelect = {
  id: true,
  employeeId: true,
  fullName: true,
  currentRole: true,
  currentDepartmentId: true,
  currentRegionId: true,
  currentShopId: true,
  currentClusterId: true,
  directManagerId: true
} as const;

export function toEmployeeScope(employee: EmployeeScopeRecord): EmployeeScope {
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

export function filterVisibleEmployees<T extends EmployeeScopeRecord>(
  principal: Principal,
  employees: T[],
  canAccess: EmployeeAccessCheck = canViewEmployee
): T[] {
  return employees.filter((employee) => canAccess(principal, toEmployeeScope(employee)));
}

export function filterEmployeeLinkedRecords<T extends { employee: EmployeeScopeRecord }>(
  principal: Principal,
  records: T[],
  canAccess: EmployeeAccessCheck = canViewEmployee
): T[] {
  return records.filter((record) => canAccess(principal, toEmployeeScope(record.employee)));
}

export function visibleEmployeeIds<T extends EmployeeScopeRecord>(
  principal: Principal,
  employees: T[],
  canAccess: EmployeeAccessCheck = canViewEmployee
): Set<string> {
  return new Set(filterVisibleEmployees(principal, employees, canAccess).map((employee) => employee.id));
}

export function filterEmployeeIdLinkedRecords<T extends { employeeId: string }>(
  principal: Principal,
  records: T[],
  employees: EmployeeScopeRecord[],
  canAccess: EmployeeAccessCheck = canViewEmployee
): T[] {
  const allowedEmployeeIds = visibleEmployeeIds(principal, employees, canAccess);
  return records.filter((record) => allowedEmployeeIds.has(record.employeeId));
}
