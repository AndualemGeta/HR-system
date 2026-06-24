import { roundMoney, type CompensationIssue } from "@/lib/phase45-validation";

export type PayeBracketInput = {
  id?: string;
  name: string;
  minIncome: number;
  maxIncome?: number | null;
  taxRate: number;
  deductionAmount: number;
};

export type PensionRuleInput = {
  id?: string;
  name: string;
  employeeRate: number;
  employerRate: number;
};

export type OvertimeRates = {
  sundayRate?: number;
  holidayRate?: number;
  nightRate?: number;
};

export type PayrollCalculationInput = {
  basicSalary: number;
  workingDays: number;
  daysPresent: number;
  paidLeaveDays: number;
  unpaidLeaveDays?: number;
  sundayOvertimeHours?: number;
  holidayOvertimeHours?: number;
  nightOvertimeHours?: number;
  approvedAllowances?: number;
  approvedCommission?: number;
  approvedDeductions?: number;
  preTaxDeductions?: number;
  manualAdjustments?: number;
  overtimeRates?: OvertimeRates;
  pensionRule?: PensionRuleInput | null;
  payeBrackets?: PayeBracketInput[];
};

export type PayrollCalculationBreakdown = {
  basicSalary: number;
  workingDays: number;
  daysPresent: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  proratedBasicSalary: number;
  sundayOvertimeHours: number;
  sundayOvertimeAmount: number;
  holidayOvertimeHours: number;
  holidayOvertimeAmount: number;
  nightOvertimeHours: number;
  nightOvertimeAmount: number;
  totalOvertimeAmount: number;
  totalAllowances: number;
  approvedCommission: number;
  grossSalary: number;
  employeePension: number;
  employerPension: number;
  taxableIncome: number;
  payeTax: number;
  totalDeductions: number;
  netSalary: number;
  employerTotalCost: number;
  rulesUsed: Record<string, unknown>;
  warnings: CompensationIssue[];
};

export function calculateProratedBasicSalary(input: {
  basicSalary: number;
  workingDays: number;
  daysPresent: number;
  paidLeaveDays: number;
}): number {
  if (input.workingDays <= 0) return 0;
  const paidSalaryDays = Math.min(input.workingDays, input.daysPresent + input.paidLeaveDays);
  return roundMoney((input.basicSalary / input.workingDays) * paidSalaryDays);
}

export function calculateOvertimePay(input: {
  basicSalary: number;
  workingDays: number;
  sundayOvertimeHours?: number;
  holidayOvertimeHours?: number;
  nightOvertimeHours?: number;
  overtimeRates?: OvertimeRates;
}) {
  const hourlyRate = input.workingDays > 0 ? input.basicSalary / input.workingDays / 8 : 0;
  const sundayOvertimeAmount = roundMoney(hourlyRate * (input.sundayOvertimeHours ?? 0) * (input.overtimeRates?.sundayRate ?? 0));
  const holidayOvertimeAmount = roundMoney(hourlyRate * (input.holidayOvertimeHours ?? 0) * (input.overtimeRates?.holidayRate ?? 0));
  const nightOvertimeAmount = roundMoney(hourlyRate * (input.nightOvertimeHours ?? 0) * (input.overtimeRates?.nightRate ?? 0));
  return {
    sundayOvertimeAmount,
    holidayOvertimeAmount,
    nightOvertimeAmount,
    totalOvertimeAmount: roundMoney(sundayOvertimeAmount + holidayOvertimeAmount + nightOvertimeAmount)
  };
}

export function calculatePayeTax(taxableIncome: number, brackets: PayeBracketInput[] = []) {
  const bracket = brackets.find((candidate) =>
    taxableIncome >= candidate.minIncome && (candidate.maxIncome == null || taxableIncome <= candidate.maxIncome)
  );
  if (!bracket) return { amount: 0, bracket: null };
  return {
    amount: Math.max(0, roundMoney(taxableIncome * bracket.taxRate - bracket.deductionAmount)),
    bracket
  };
}

export function calculatePayrollWarnings(input: PayrollCalculationInput): CompensationIssue[] {
  const warnings: CompensationIssue[] = [];
  if (input.workingDays <= 0) warnings.push({ severity: "BLOCKER", field: "workingDays", message: "Working days must be greater than zero." });
  if (!input.pensionRule) warnings.push({ severity: "WARNING", field: "pensionRule", message: "No active pension rule was provided." });
  if (!input.payeBrackets || input.payeBrackets.length === 0) warnings.push({ severity: "BLOCKER", field: "payeBrackets", message: "No active PAYE bracket was provided." });
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === "number" && value < 0) warnings.push({ severity: "BLOCKER", field, message: `${field} cannot be negative.` });
  }
  return warnings;
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationBreakdown {
  const warnings = calculatePayrollWarnings(input);
  const proratedBasicSalary = calculateProratedBasicSalary(input);
  const overtime = calculateOvertimePay(input);
  const totalAllowances = roundMoney(input.approvedAllowances ?? 0);
  const approvedCommission = roundMoney(input.approvedCommission ?? 0);
  const grossSalary = roundMoney(
    proratedBasicSalary +
      overtime.totalOvertimeAmount +
      totalAllowances +
      approvedCommission +
      (input.manualAdjustments ?? 0)
  );
  const employeePension = roundMoney(grossSalary * (input.pensionRule?.employeeRate ?? 0));
  const employerPension = roundMoney(grossSalary * (input.pensionRule?.employerRate ?? 0));
  const taxableIncome = Math.max(0, roundMoney(grossSalary - (input.preTaxDeductions ?? 0)));
  const paye = calculatePayeTax(taxableIncome, input.payeBrackets);
  const totalDeductions = roundMoney((input.approvedDeductions ?? 0) + employeePension + paye.amount);
  const netSalary = roundMoney(grossSalary - totalDeductions);

  return {
    basicSalary: roundMoney(input.basicSalary),
    workingDays: input.workingDays,
    daysPresent: input.daysPresent,
    paidLeaveDays: input.paidLeaveDays,
    unpaidLeaveDays: input.unpaidLeaveDays ?? 0,
    proratedBasicSalary,
    sundayOvertimeHours: input.sundayOvertimeHours ?? 0,
    sundayOvertimeAmount: overtime.sundayOvertimeAmount,
    holidayOvertimeHours: input.holidayOvertimeHours ?? 0,
    holidayOvertimeAmount: overtime.holidayOvertimeAmount,
    nightOvertimeHours: input.nightOvertimeHours ?? 0,
    nightOvertimeAmount: overtime.nightOvertimeAmount,
    totalOvertimeAmount: overtime.totalOvertimeAmount,
    totalAllowances,
    approvedCommission,
    grossSalary,
    employeePension,
    employerPension,
    taxableIncome,
    payeTax: paye.amount,
    totalDeductions,
    netSalary,
    employerTotalCost: roundMoney(grossSalary + employerPension),
    rulesUsed: {
      pensionRule: input.pensionRule?.id ?? input.pensionRule?.name ?? null,
      payeBracket: paye.bracket?.id ?? paye.bracket?.name ?? null,
      overtimeRates: input.overtimeRates ?? {}
    },
    warnings
  };
}

export function calculateCommission(input: {
  calculationType: "FIXED_AMOUNT" | "PERCENT_OF_SALES" | "TIERED_PERCENT" | "TARGET_BASED" | "MANUAL" | "NONE";
  salesAmount?: number | null;
  targetAmount?: number | null;
  rate?: number | null;
  fixedAmount?: number | null;
  capAmount?: number | null;
  manualAdjustment?: number | null;
}) {
  let calculatedCommission = 0;
  const sales = input.salesAmount ?? 0;
  const achievementPercent = input.targetAmount && input.targetAmount > 0 ? roundMoney((sales / input.targetAmount) * 100) : null;

  if (input.calculationType === "FIXED_AMOUNT") calculatedCommission = input.fixedAmount ?? 0;
  if (input.calculationType === "PERCENT_OF_SALES") calculatedCommission = sales * (input.rate ?? 0);
  if (input.calculationType === "TARGET_BASED") calculatedCommission = (achievementPercent ?? 0) >= 100 ? sales * (input.rate ?? 0) : 0;
  if (input.calculationType === "MANUAL") calculatedCommission = input.manualAdjustment ?? 0;

  const capped = input.capAmount == null ? calculatedCommission : Math.min(calculatedCommission, input.capAmount);
  return {
    achievementPercent,
    calculatedCommission: roundMoney(calculatedCommission),
    finalCommission: roundMoney(capped)
  };
}
