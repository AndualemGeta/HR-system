import {
  allowedStatusTransitions,
  clusterRequiredRoles,
  evaluatorRequiredRoles,
  headOfficeRoles,
  managerRequiredRoles,
  shopBasedRoles,
  terminalStatuses,
  type EmployeeRoleValue,
  type EmploymentStatusValue,
  type EmploymentTypeValue
} from "./constants";

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult = {
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  reviewItems: ValidationIssue[];
};

export type EmployeeValidationInput = {
  employeeId?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  employmentType?: EmploymentTypeValue | null;
  employmentStatus?: EmploymentStatusValue | null;
  currentRole?: EmployeeRoleValue | null;
  currentDepartmentId?: string | null;
  currentRegionId?: string | null;
  currentShopId?: string | null;
  currentClusterId?: string | null;
  directManagerId?: string | null;
  currentEvaluatorId?: string | null;
  basicSalary?: number | string | null;
  onboardingComplete?: boolean;
  activeAssignmentCount?: number;
  approvedClusterException?: boolean;
  terminationLastWorkingDate?: string | Date | null;
};

export function emptyValidationResult(): ValidationResult {
  return {
    blockers: [],
    warnings: [],
    reviewItems: []
  };
}

export function validateStatusTransition(
  previousStatus: EmploymentStatusValue,
  nextStatus: EmploymentStatusValue
): ValidationResult {
  const result = emptyValidationResult();
  if (previousStatus === nextStatus) return result;

  if (terminalStatuses.has(previousStatus) && nextStatus !== "EXITED") {
    result.blockers.push({
      field: "employmentStatus",
      message: `Employees in ${previousStatus} cannot transition to ${nextStatus}.`
    });
    return result;
  }

  if (!allowedStatusTransitions[previousStatus].includes(nextStatus)) {
    result.blockers.push({
      field: "employmentStatus",
      message: `Invalid status transition from ${previousStatus} to ${nextStatus}.`
    });
  }

  return result;
}

export function validateEmployeeLifecycle(input: EmployeeValidationInput): ValidationResult {
  const result = emptyValidationResult();
  const role = input.currentRole;
  const status = input.employmentStatus ?? "DRAFT";

  if (!input.employeeId) {
    result.reviewItems.push({
      field: "employeeId",
      message: "Employee ID is missing and must be generated or confirmed."
    });
  }

  if (!input.fullName && (!input.firstName || !input.lastName)) {
    result.blockers.push({
      field: "fullName",
      message: "Full name or first and last name is required."
    });
  }

  if (status === "ACTIVE" || status === "ON_PROBATION") {
    if (!input.employmentType) {
      result.blockers.push({
        field: "employmentType",
        message: "Employment type is required before an employee can become active or on probation."
      });
    }

    if (!input.onboardingComplete) {
      result.blockers.push({
        field: "onboarding",
        message: "Active employees must have a completed onboarding checklist."
      });
    }
  }

  if (role && managerRequiredRoles.has(role) && !input.directManagerId) {
    result.blockers.push({
      field: "directManagerId",
      message: `${role} requires a direct manager unless an explicit exception is approved.`
    });
  }

  if (role && evaluatorRequiredRoles.has(role) && !input.currentEvaluatorId) {
    result.reviewItems.push({
      field: "currentEvaluatorId",
      message: `${role} usually requires an evaluator.`
    });
  }

  if (role && headOfficeRoles.has(role) && !input.currentDepartmentId) {
    result.blockers.push({
      field: "currentDepartmentId",
      message: "Head Office employees require a department assignment."
    });
  }

  if (role && shopBasedRoles.has(role)) {
    if (!input.currentRegionId) {
      result.blockers.push({
        field: "currentRegionId",
        message: "Shop-based employees require a region."
      });
    }
    if (!input.currentShopId) {
      result.blockers.push({
        field: "currentShopId",
        message: "Shop-based employees require a shop."
      });
    }
  }

  if (
    role &&
    clusterRequiredRoles.has(role) &&
    !input.currentClusterId &&
    !input.approvedClusterException
  ) {
    result.blockers.push({
      field: "currentClusterId",
      message: `${role} employees must belong to exactly one active cluster unless an exception is approved.`
    });
  }

  if ((input.activeAssignmentCount ?? 0) > 1) {
    result.blockers.push({
      field: "assignments",
      message: "Only one active assignment is allowed unless multi-assignment mode is enabled."
    });
  }

  if ((status === "ACTIVE" || status === "ON_PROBATION") && !input.basicSalary) {
    result.warnings.push({
      field: "basicSalary",
      message: "Salary is missing for a payroll-ready employee."
    });
  }

  if ((status === "TERMINATED" || status === "RESIGNED") && !input.terminationLastWorkingDate) {
    result.blockers.push({
      field: "lastWorkingDate",
      message: "Termination or resignation requires a last working date."
    });
  }

  if (!input.phoneNumber && !input.email) {
    result.warnings.push({
      field: "contact",
      message: "Phone number or email is recommended for duplicate detection and contact records."
    });
  }

  return result;
}

export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  return results.reduce(
    (merged, result) => ({
      blockers: [...merged.blockers, ...result.blockers],
      warnings: [...merged.warnings, ...result.warnings],
      reviewItems: [...merged.reviewItems, ...result.reviewItems]
    }),
    emptyValidationResult()
  );
}
