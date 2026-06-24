import type { CompensationIssue } from "@/lib/phase45-validation";

export const PAYROLL_RULE_SETUP_WARNING =
  "Payroll rules must be verified and approved by HR/Finance before production payroll use.";

export type GovernedPayrollRule = {
  activeStatus: boolean;
  effectiveStartDate: Date;
  effectiveEndDate?: Date | null;
  approvalStatus?: string | null;
  approvedById?: string | null;
  isSample?: boolean | null;
};

export function isApprovedEffectivePayrollRule(rule: GovernedPayrollRule, onDate = new Date()): boolean {
  return Boolean(
    rule.activeStatus &&
      rule.approvalStatus === "APPROVED" &&
      rule.approvedById &&
      !rule.isSample &&
      rule.effectiveStartDate <= onDate &&
      (!rule.effectiveEndDate || rule.effectiveEndDate >= onDate)
  );
}

export function payrollRuleSetupIssues(input: {
  payeRuleCount: number;
  pensionRuleCount: number;
  overtimeRuleCount: number;
  workingDayRuleCount: number;
  hasSampleRules?: boolean;
  hasUnapprovedRules?: boolean;
  hasExpiredRules?: boolean;
}): CompensationIssue[] {
  const issues: CompensationIssue[] = [];
  if (input.payeRuleCount === 0) {
    issues.push(setupIssue("payeBrackets", "No approved, active PAYE tax brackets are available for this payroll period."));
  }
  if (input.pensionRuleCount === 0) {
    issues.push(setupIssue("pensionRule", "No approved, active pension rule is available for this payroll period."));
  }
  if (input.overtimeRuleCount === 0) {
    issues.push(setupIssue("overtimeRates", "No approved overtime rates are configured for this payroll period."));
  }
  if (input.workingDayRuleCount === 0) {
    issues.push(setupIssue("workingDays", "No approved default working-day rule is configured for this payroll period."));
  }
  if (input.hasSampleRules) {
    issues.push(setupIssue("sampleRules", "Sample payroll rules are present and must not be used for production payroll."));
  }
  if (input.hasUnapprovedRules) {
    issues.push(setupIssue("approvalStatus", "Draft, submitted, or rejected payroll rules exist and require HR/Finance review."));
  }
  if (input.hasExpiredRules) {
    issues.push(setupIssue("effectiveDates", "Expired payroll rules exist and should be replaced or deactivated."));
  }
  return issues;
}

function setupIssue(field: string, message: string): CompensationIssue {
  return {
    severity: "BLOCKER",
    field,
    message: `${message} ${PAYROLL_RULE_SETUP_WARNING}`
  };
}
