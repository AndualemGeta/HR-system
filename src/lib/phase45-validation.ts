import type { CommissionCalculationType } from "@prisma/client";

export type CompensationIssue = {
  severity: "BLOCKER" | "WARNING" | "REVIEW";
  field: string;
  message: string;
};

export function salaryReviewChange(currentSalary: number | null | undefined, proposedSalary: number) {
  const current = currentSalary ?? 0;
  const changeAmount = roundMoney(proposedSalary - current);
  const changePercent = current > 0 ? Math.round((changeAmount / current) * 10000) / 100 : 0;
  return { changeAmount, changePercent };
}

export function validateSalaryReview(input: {
  proposedSalary?: number | null;
  effectiveDate?: string | Date | null;
  status?: string | null;
  reason?: string | null;
}): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (input.proposedSalary == null || !Number.isFinite(input.proposedSalary)) {
    issues.push({ severity: "BLOCKER", field: "proposedSalary", message: "Proposed salary is required." });
  } else if (input.proposedSalary < 0) {
    issues.push({ severity: "BLOCKER", field: "proposedSalary", message: "Proposed salary cannot be negative." });
  }
  if (!input.reason) issues.push({ severity: "WARNING", field: "reason", message: "Salary review should include a reason." });
  if (["APPROVED", "COMPLETED"].includes(input.status ?? "") && !input.effectiveDate) {
    issues.push({ severity: "BLOCKER", field: "effectiveDate", message: "Effective date is required before approval." });
  }
  return issues;
}

export function isEffective(input: { activeStatus: boolean; effectiveStartDate: Date; effectiveEndDate?: Date | null }, onDate = new Date()): boolean {
  return input.activeStatus && input.effectiveStartDate <= onDate && (!input.effectiveEndDate || input.effectiveEndDate >= onDate);
}

export function validateEffectiveDates(input: { effectiveStartDate?: string | Date | null; effectiveEndDate?: string | Date | null }): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (!input.effectiveStartDate) issues.push({ severity: "BLOCKER", field: "effectiveStartDate", message: "Effective start date is required." });
  if (input.effectiveStartDate && input.effectiveEndDate && new Date(input.effectiveEndDate) < new Date(input.effectiveStartDate)) {
    issues.push({ severity: "BLOCKER", field: "effectiveEndDate", message: "Effective end date cannot be before start date." });
  }
  return issues;
}

export function validatePayeBracket(input: {
  minIncome?: number | null;
  maxIncome?: number | null;
  taxRate?: number | null;
  deductionAmount?: number | null;
}): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (input.minIncome == null || input.minIncome < 0) issues.push({ severity: "BLOCKER", field: "minIncome", message: "Minimum income cannot be negative." });
  if (input.maxIncome != null && input.minIncome != null && input.maxIncome < input.minIncome) {
    issues.push({ severity: "BLOCKER", field: "maxIncome", message: "Maximum income cannot be below minimum income." });
  }
  if (input.taxRate == null || input.taxRate < 0) issues.push({ severity: "BLOCKER", field: "taxRate", message: "PAYE tax rate cannot be negative." });
  if (input.deductionAmount != null && input.deductionAmount < 0) {
    issues.push({ severity: "BLOCKER", field: "deductionAmount", message: "Deduction amount cannot be negative." });
  }
  return issues;
}

export function payeBracketsOverlap(
  candidate: { minIncome: number; maxIncome?: number | null },
  existing: Array<{ minIncome: number; maxIncome?: number | null }>
): boolean {
  const candidateMax = candidate.maxIncome ?? Number.POSITIVE_INFINITY;
  return existing.some((bracket) => {
    const existingMax = bracket.maxIncome ?? Number.POSITIVE_INFINITY;
    return candidate.minIncome <= existingMax && bracket.minIncome <= candidateMax;
  });
}

export function validatePensionRule(input: { employeeRate?: number | null; employerRate?: number | null }): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (input.employeeRate == null || input.employeeRate < 0) issues.push({ severity: "BLOCKER", field: "employeeRate", message: "Employee pension rate cannot be negative." });
  if (input.employerRate == null || input.employerRate < 0) issues.push({ severity: "BLOCKER", field: "employerRate", message: "Employer pension rate cannot be negative." });
  return issues;
}

export function validateAttendanceInput(input: {
  workingDays?: number | null;
  daysPresent?: number | null;
  daysAbsent?: number | null;
  paidLeaveDays?: number | null;
  unpaidLeaveDays?: number | null;
  sundayOvertimeHours?: number | null;
  holidayOvertimeHours?: number | null;
  nightOvertimeHours?: number | null;
}): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  const workingDays = input.workingDays ?? 0;
  if (workingDays <= 0) issues.push({ severity: "BLOCKER", field: "workingDays", message: "Working days must be greater than zero." });
  for (const field of ["daysPresent", "daysAbsent", "paidLeaveDays", "unpaidLeaveDays", "sundayOvertimeHours", "holidayOvertimeHours", "nightOvertimeHours"] as const) {
    if ((input[field] ?? 0) < 0) issues.push({ severity: "BLOCKER", field, message: `${field} cannot be negative.` });
  }
  const countedDays = (input.daysPresent ?? 0) + (input.daysAbsent ?? 0) + (input.paidLeaveDays ?? 0) + (input.unpaidLeaveDays ?? 0);
  if (workingDays > 0 && countedDays > workingDays) {
    issues.push({ severity: "WARNING", field: "attendanceDays", message: "Attendance day totals exceed working days." });
  }
  return issues;
}

export function validateAllowance(input: { amount?: number | null }): CompensationIssue[] {
  return input.amount == null || input.amount < 0
    ? [{ severity: "BLOCKER", field: "amount", message: "Allowance amount cannot be negative." }]
    : [];
}

export function validateDeduction(input: { amount?: number | null; deductionType?: string | null; reason?: string | null }): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (input.amount == null || input.amount < 0) issues.push({ severity: "BLOCKER", field: "amount", message: "Deduction amount cannot be negative." });
  if (input.deductionType && input.deductionType !== "ABSENCE_DEDUCTION" && !input.reason) {
    issues.push({ severity: "BLOCKER", field: "reason", message: "Manual deductions require a reason." });
  }
  return issues;
}

export function validateCommissionPlan(input: {
  calculationType?: CommissionCalculationType | null;
  rate?: number | null;
  capAmount?: number | null;
  effectiveStartDate?: string | Date | null;
}): CompensationIssue[] {
  const issues = validateEffectiveDates({ effectiveStartDate: input.effectiveStartDate });
  if (input.rate != null && input.rate < 0) issues.push({ severity: "BLOCKER", field: "rate", message: "Commission rate cannot be negative." });
  if (input.capAmount != null && input.capAmount < 0) issues.push({ severity: "BLOCKER", field: "capAmount", message: "Commission cap cannot be negative." });
  if (["PERCENT_OF_SALES", "TIERED_PERCENT", "TARGET_BASED"].includes(input.calculationType ?? "") && input.rate == null) {
    issues.push({ severity: "BLOCKER", field: "rate", message: "Rate is required for this commission plan type." });
  }
  return issues;
}

export function validateCommissionCalculation(input: {
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  manualAdjustment?: number | null;
  manualAdjustmentReason?: string | null;
}): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (!input.periodStart || !input.periodEnd) issues.push({ severity: "BLOCKER", field: "period", message: "Commission period is required." });
  if (input.periodStart && input.periodEnd && new Date(input.periodEnd) < new Date(input.periodStart)) {
    issues.push({ severity: "BLOCKER", field: "periodEnd", message: "Commission period end cannot be before start." });
  }
  if ((input.manualAdjustment ?? 0) !== 0 && !input.manualAdjustmentReason) {
    issues.push({ severity: "BLOCKER", field: "manualAdjustmentReason", message: "Manual commission adjustment requires a reason." });
  }
  return issues;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
