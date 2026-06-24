import { clusterRequiredRoles, headOfficeRoles, shopBasedRoles, type EmployeeRoleValue } from "@/lib/constants";

export type Phase3Issue = {
  field: string;
  message: string;
};

export function validateDisciplinarySubmission(input: {
  employeeId?: string | null;
  incidentType?: string | null;
  incidentDate?: string | Date | null;
  description?: string | null;
}): Phase3Issue[] {
  const issues: Phase3Issue[] = [];
  if (!input.employeeId) issues.push({ field: "employeeId", message: "Employee is required." });
  if (!input.incidentType) issues.push({ field: "incidentType", message: "Incident type is required before submission." });
  if (!input.incidentDate) issues.push({ field: "incidentDate", message: "Incident date is required before submission." });
  if (!input.description?.trim()) issues.push({ field: "description", message: "Description is required before submission." });
  return issues;
}

export function validateTerminationApproval(input: {
  reason?: string | null;
  lastWorkingDate?: string | Date | null;
}): Phase3Issue[] {
  const issues: Phase3Issue[] = [];
  if (!input.reason?.trim()) issues.push({ field: "reason", message: "Termination reason is required." });
  if (!input.lastWorkingDate) issues.push({ field: "lastWorkingDate", message: "Last working date is required before approval." });
  return issues;
}

export function validateExitCompletion(
  items: Array<{ isRequired: boolean; completed: boolean }>,
  overrideReason?: string | null
): Phase3Issue[] {
  const incompleteRequired = items.some((item) => item.isRequired && !item.completed);
  if (incompleteRequired && !overrideReason?.trim()) {
    return [{ field: "exitChecklist", message: "Required exit checklist items must be completed or overridden with a reason." }];
  }
  return [];
}

export function validateTransferApproval(input: {
  requestedRole?: EmployeeRoleValue | null;
  requestedDepartmentId?: string | null;
  requestedRegionId?: string | null;
  requestedShopId?: string | null;
  requestedClusterId?: string | null;
  effectiveDate?: string | Date | null;
}): Phase3Issue[] {
  const issues: Phase3Issue[] = [];
  const role = input.requestedRole ?? null;
  if (!input.effectiveDate) issues.push({ field: "effectiveDate", message: "Effective date is required before approval." });
  if (role && shopBasedRoles.has(role)) {
    if (!input.requestedRegionId) issues.push({ field: "requestedRegionId", message: "Shop-based transfer requires a region." });
    if (!input.requestedShopId) issues.push({ field: "requestedShopId", message: "Shop-based transfer requires a shop." });
  }
  if (role && clusterRequiredRoles.has(role) && !input.requestedClusterId) {
    issues.push({ field: "requestedClusterId", message: "Cluster-based role requires a cluster." });
  }
  if (role && headOfficeRoles.has(role) && !input.requestedDepartmentId) {
    issues.push({ field: "requestedDepartmentId", message: "Head office transfer requires a department." });
  }
  return issues;
}

export function validatePromotionApproval(input: {
  proposedRole?: string | null;
  proposedLevel?: string | null;
  proposedSalary?: number | null;
  effectiveDate?: string | Date | null;
  canChangeSalary?: boolean;
}): Phase3Issue[] {
  const issues: Phase3Issue[] = [];
  if (!input.proposedRole && !input.proposedLevel) {
    issues.push({ field: "promotion", message: "Promotion requires a proposed role or proposed level." });
  }
  if (!input.effectiveDate) issues.push({ field: "effectiveDate", message: "Effective date is required before approval." });
  if (input.proposedSalary && !input.canChangeSalary) {
    issues.push({ field: "proposedSalary", message: "Salary changes require salary permission." });
  }
  return issues;
}

export function validateApprovalWorkflowActivation(input: { activeStatus: boolean; activeStepCount: number }): Phase3Issue[] {
  if (input.activeStatus && input.activeStepCount < 1) {
    return [{ field: "steps", message: "Active approval workflows require at least one active step." }];
  }
  return [];
}
