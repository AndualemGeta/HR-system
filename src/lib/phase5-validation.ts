import crypto from "node:crypto";
import type { AttendanceStatus } from "@prisma/client";

export type Phase5Issue = {
  severity: "BLOCKER" | "WARNING" | "REVIEW";
  field: string;
  message: string;
};

const restrictedTemplateFields = new Set([
  "basicSalary",
  "grossSalary",
  "netSalary",
  "payeTax",
  "employeePension",
  "employerPension",
  "approvedCommission",
  "employerTotalCost",
  "disciplinary",
  "termination"
]);

export function validatePayrollExportTemplate(input: { fieldMapping?: unknown }): Phase5Issue[] {
  if (!input.fieldMapping || typeof input.fieldMapping !== "object" || Array.isArray(input.fieldMapping)) {
    return [{ severity: "BLOCKER", field: "fieldMapping", message: "Payroll export template requires a field mapping." }];
  }
  if (Object.keys(input.fieldMapping as Record<string, unknown>).length === 0) {
    return [{ severity: "BLOCKER", field: "fieldMapping", message: "Payroll export template must map at least one field." }];
  }
  return [];
}

export function templateUsesRestrictedFields(fieldMapping: Record<string, string>): boolean {
  return Object.keys(fieldMapping).some((field) => restrictedTemplateFields.has(field));
}

export function isPayrollPeriodLocked(
  locks: Array<{ payrollPeriodStart: Date; payrollPeriodEnd: Date; lockStatus: string }>,
  periodStart: Date,
  periodEnd: Date
): boolean {
  return locks.some(
    (lock) =>
      lock.lockStatus === "LOCKED" &&
      lock.payrollPeriodStart.getTime() <= periodEnd.getTime() &&
      lock.payrollPeriodEnd.getTime() >= periodStart.getTime()
  );
}

export function validateUnlockRequest(input: { reason?: string | null }): Phase5Issue[] {
  return input.reason?.trim()
    ? []
    : [{ severity: "BLOCKER", field: "reason", message: "Unlocking payroll requires a business reason." }];
}

export function validatePayrollAdjustment(input: { amount?: number | null; reason?: string | null }): Phase5Issue[] {
  const issues: Phase5Issue[] = [];
  if (input.amount == null || !Number.isFinite(input.amount) || input.amount === 0) {
    issues.push({ severity: "BLOCKER", field: "amount", message: "Payroll adjustment amount must be a non-zero number." });
  }
  if (!input.reason?.trim()) issues.push({ severity: "BLOCKER", field: "reason", message: "Payroll adjustment requires a reason." });
  return issues;
}

export function validateAttendanceRecord(input: {
  employeeId?: string | null;
  attendanceDate?: string | Date | null;
  status?: AttendanceStatus | string | null;
  hoursWorked?: number | null;
  overtimeHours?: number | null;
}): Phase5Issue[] {
  const issues: Phase5Issue[] = [];
  if (!input.employeeId) issues.push({ severity: "BLOCKER", field: "employeeId", message: "Employee is required for attendance." });
  if (!input.attendanceDate) issues.push({ severity: "BLOCKER", field: "attendanceDate", message: "Attendance date is required." });
  if (!input.status) issues.push({ severity: "BLOCKER", field: "status", message: "Attendance status is required." });
  if ((input.hoursWorked ?? 0) < 0) issues.push({ severity: "BLOCKER", field: "hoursWorked", message: "Hours worked cannot be negative." });
  if ((input.overtimeHours ?? 0) < 0) issues.push({ severity: "BLOCKER", field: "overtimeHours", message: "Overtime hours cannot be negative." });
  return issues;
}

export function previewAttendanceImport(
  rows: Array<Record<string, unknown>>,
  knownEmployeeIds: Set<string>,
  existingKeys = new Set<string>()
) {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const employeeId = String(row["Employee ID"] ?? row.employeeId ?? "").trim();
    const date = String(row.Date ?? row.date ?? "").trim();
    const status = String(row.Status ?? row.status ?? "").trim().toUpperCase();
    const key = `${employeeId}|${date}`;
    const blockers: Phase5Issue[] = [];
    if (!knownEmployeeIds.has(employeeId)) blockers.push({ severity: "BLOCKER", field: "employeeId", message: "Unknown employee ID." });
    if (!date || Number.isNaN(Date.parse(date))) blockers.push({ severity: "BLOCKER", field: "date", message: "Attendance date is invalid." });
    if (!status) blockers.push({ severity: "BLOCKER", field: "status", message: "Attendance status is required." });
    if (seen.has(key) || existingKeys.has(key)) blockers.push({ severity: "BLOCKER", field: "duplicate", message: "Duplicate employee/date attendance row." });
    seen.add(key);
    return { rowNumber: index + 1, employeeId, date, status, blockers, statusLabel: blockers.length ? "BLOCKED" : "CLEAN" };
  });
}

export function calculateLeaveClosingBalance(input: {
  openingBalance: number;
  accruedDays: number;
  usedDays: number;
  adjustedDays: number;
}): number {
  return Math.round((input.openingBalance + input.accruedDays + input.adjustedDays - input.usedDays) * 100) / 100;
}

export function validateLeavePolicy(input: { effectiveStartDate?: string | Date | null; annualEntitlementDays?: number | null }): Phase5Issue[] {
  const issues: Phase5Issue[] = [];
  if (!input.effectiveStartDate) issues.push({ severity: "BLOCKER", field: "effectiveStartDate", message: "Leave policy effective date is required." });
  if (input.annualEntitlementDays == null || input.annualEntitlementDays < 0) {
    issues.push({ severity: "BLOCKER", field: "annualEntitlementDays", message: "Leave entitlement cannot be negative." });
  }
  return issues;
}

export function validateLeaveBalance(input: { closingBalance: number; allowNegative?: boolean }): Phase5Issue[] {
  return input.closingBalance < 0 && !input.allowNegative
    ? [{ severity: "BLOCKER", field: "closingBalance", message: "Leave balance cannot go negative without override permission." }]
    : [];
}

export function validateKpiWeights(weights: Array<{ weight: number }>, enforceTotal = true): Phase5Issue[] {
  const issues: Phase5Issue[] = [];
  for (const weight of weights) {
    if (weight.weight <= 0 || weight.weight > 100) issues.push({ severity: "BLOCKER", field: "weight", message: "KPI weight must be between 0 and 100." });
  }
  const total = Math.round(weights.reduce((sum, weight) => sum + weight.weight, 0) * 100) / 100;
  if (enforceTotal && total !== 100) issues.push({ severity: "BLOCKER", field: "weightTotal", message: "KPI evaluation weights must total 100%." });
  return issues;
}

export function validateEmailTemplate(input: { subjectTemplate: string; bodyTemplate: string; recipientCanViewRestricted?: boolean }): Phase5Issue[] {
  const content = `${input.subjectTemplate} ${input.bodyTemplate}`;
  if (!input.recipientCanViewRestricted && /\{\{\s*(salary|payroll|disciplinary|termination|commission)/i.test(content)) {
    return [{ severity: "BLOCKER", field: "bodyTemplate", message: "Email template exposes restricted fields to unauthorized recipients." }];
  }
  return [];
}

export function validateRetentionPolicy(input: { retentionPeriodDays?: number | null; actionAfterRetention?: string | null; entityType?: string | null }): Phase5Issue[] {
  const issues: Phase5Issue[] = [];
  if (!input.retentionPeriodDays || input.retentionPeriodDays <= 0) {
    issues.push({ severity: "BLOCKER", field: "retentionPeriodDays", message: "Retention period must be a positive number of days." });
  }
  if (input.entityType === "AUDIT_LOG" && input.actionAfterRetention === "DELETE_IF_ALLOWED") {
    issues.push({ severity: "BLOCKER", field: "actionAfterRetention", message: "Audit logs must not default to deletion." });
  }
  return issues;
}

export function hashIntegrationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function validateIntegrationToken(input: { scopes?: string[]; expiresAt?: string | Date | null }): Phase5Issue[] {
  const issues: Phase5Issue[] = [];
  if (!input.scopes || input.scopes.length === 0) issues.push({ severity: "BLOCKER", field: "allowedScopes", message: "Integration token requires at least one scope." });
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) issues.push({ severity: "BLOCKER", field: "expiresAt", message: "Integration token expiry must be in the future." });
  return issues;
}
