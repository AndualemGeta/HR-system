import type { EmployeeRoleValue } from "@/lib/constants";
import { clusterRequiredRoles, managerRequiredRoles, shopBasedRoles } from "@/lib/constants";

export type Phase4Issue = {
  severity: "BLOCKER" | "WARNING" | "REVIEW";
  field: string;
  message: string;
};

export function validatePayrollPeriod(input: { start?: string | Date | null; end?: string | Date | null }): Phase4Issue[] {
  const issues: Phase4Issue[] = [];
  if (!input.start) issues.push({ severity: "BLOCKER", field: "payrollPeriodStart", message: "Payroll period start is required." });
  if (!input.end) issues.push({ severity: "BLOCKER", field: "payrollPeriodEnd", message: "Payroll period end is required." });
  if (input.start && input.end && new Date(input.end) < new Date(input.start)) {
    issues.push({ severity: "BLOCKER", field: "payrollPeriodEnd", message: "Payroll period end cannot be before start." });
  }
  return issues;
}

export function validatePayrollEmployee(input: {
  employeeId?: string | null;
  fullName?: string | null;
  employmentType?: string | null;
  employmentStatus?: string | null;
  currentRole?: EmployeeRoleValue | null;
  currentRegionId?: string | null;
  currentShopId?: string | null;
  currentClusterId?: string | null;
  directManagerId?: string | null;
  activeAssignmentCount?: number;
  basicSalary?: unknown;
  salaryEffectiveDate?: Date | null;
  salaryOptionalForCommission?: boolean;
}): Phase4Issue[] {
  const issues: Phase4Issue[] = [];
  if (!["ACTIVE", "ON_PROBATION"].includes(input.employmentStatus ?? "")) {
    issues.push({ severity: "BLOCKER", field: "employmentStatus", message: "Employee must be ACTIVE or ON_PROBATION for payroll." });
  }
  if (!input.employeeId) issues.push({ severity: "BLOCKER", field: "employeeId", message: "Employee ID is required." });
  if (!input.fullName) issues.push({ severity: "BLOCKER", field: "fullName", message: "Full name is required." });
  if (!input.employmentType) issues.push({ severity: "BLOCKER", field: "employmentType", message: "Employment type is required." });
  if ((input.activeAssignmentCount ?? 0) !== 1) {
    issues.push({ severity: "BLOCKER", field: "assignment", message: "Exactly one active assignment is required." });
  }
  if (input.currentRole && managerRequiredRoles.has(input.currentRole) && !input.directManagerId) {
    issues.push({ severity: "BLOCKER", field: "directManagerId", message: "Direct manager is required for this role." });
  }
  if (input.currentRole && shopBasedRoles.has(input.currentRole)) {
    if (!input.currentRegionId) issues.push({ severity: "BLOCKER", field: "currentRegionId", message: "Shop-based employee requires a region." });
    if (!input.currentShopId) issues.push({ severity: "BLOCKER", field: "currentShopId", message: "Shop-based employee requires a shop." });
  }
  if (input.currentRole && clusterRequiredRoles.has(input.currentRole) && !input.currentClusterId) {
    issues.push({ severity: "BLOCKER", field: "currentClusterId", message: "Cluster role requires a cluster." });
  }
  const salaryOptional = input.employmentType === "COMMISSION_BASED" && input.salaryOptionalForCommission;
  if (!salaryOptional && !input.basicSalary) {
    issues.push({ severity: "BLOCKER", field: "basicSalary", message: "Basic salary is required for payroll." });
  }
  if (!salaryOptional && !input.salaryEffectiveDate) {
    issues.push({ severity: "WARNING", field: "salaryEffectiveDate", message: "Salary effective date is missing." });
  }
  return issues;
}

export function payrollReadinessStatus(issues: Phase4Issue[]): "READY" | "WARNING" | "BLOCKED" {
  if (issues.some((issue) => issue.severity === "BLOCKER")) return "BLOCKED";
  if (issues.length > 0) return "WARNING";
  return "READY";
}

export function calculateAchievementPercent(targetValue: number | null | undefined, actualValue: number): number | null {
  if (!targetValue || targetValue <= 0) return null;
  return Math.round((actualValue / targetValue) * 10000) / 100;
}

export function ratingFromAchievement(percent: number | null): "EXCEEDED" | "MET" | "PARTIALLY_MET" | "NOT_MET" | "NOT_APPLICABLE" {
  if (percent == null) return "NOT_APPLICABLE";
  if (percent >= 110) return "EXCEEDED";
  if (percent >= 90) return "MET";
  if (percent >= 60) return "PARTIALLY_MET";
  return "NOT_MET";
}

export function validateKpiResult(input: {
  employeeId?: string | null;
  metricId?: string | null;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  actualValue?: number | null;
}): Phase4Issue[] {
  const issues: Phase4Issue[] = [];
  if (!input.employeeId) issues.push({ severity: "BLOCKER", field: "employeeId", message: "Employee is required." });
  if (!input.metricId) issues.push({ severity: "BLOCKER", field: "metricId", message: "KPI metric is required." });
  if (!input.periodStart || !input.periodEnd) issues.push({ severity: "BLOCKER", field: "period", message: "KPI period is required." });
  if (input.actualValue == null || !Number.isFinite(input.actualValue)) {
    issues.push({ severity: "BLOCKER", field: "actualValue", message: "Actual value must be numeric." });
  }
  return issues;
}

export function validateProfileChangeField(field: string): boolean {
  return ["PHONE_NUMBER", "ADDRESS", "PERSONAL_EMAIL", "EMERGENCY_CONTACT"].includes(field);
}

export function validateGovernanceSettings(input: {
  activeStatus: boolean;
  requiredStepCount: number;
  escalationAfterDays?: number | null;
  fallbackConfigured?: boolean;
}): Phase4Issue[] {
  const issues: Phase4Issue[] = [];
  if (input.activeStatus && input.requiredStepCount < 1) {
    issues.push({ severity: "BLOCKER", field: "steps", message: "Active workflows require at least one required step." });
  }
  if (input.escalationAfterDays != null && input.escalationAfterDays <= 0) {
    issues.push({ severity: "BLOCKER", field: "escalationAfterDays", message: "Escalation days must be positive." });
  }
  if (input.escalationAfterDays && !input.fallbackConfigured) {
    issues.push({ severity: "WARNING", field: "fallback", message: "Escalation should include a fallback approver or role." });
  }
  return issues;
}

export function reminderComputedStatus(dueDate: Date, currentStatus: "OPEN" | "COMPLETED" | "CANCELLED" | "OVERDUE", now = new Date()) {
  if (currentStatus !== "OPEN") return currentStatus;
  return dueDate < now ? "OVERDUE" : "OPEN";
}
