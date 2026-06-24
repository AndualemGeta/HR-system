export const payrollImportAliases = {
  employeeId: ["employee id", "employeeid", "staff id", "id"],
  workingDays: ["working days", "work days"],
  daysPresent: ["days present", "present days"],
  paidLeaveDays: ["paid leave", "paid leave days"],
  unpaidLeaveDays: ["unpaid leave", "unpaid leave days"],
  sundayOvertimeHours: ["sunday overtime", "sunday overtime hours"],
  holidayOvertimeHours: ["holiday overtime", "holiday overtime hours"],
  nightOvertimeHours: ["night overtime", "night overtime hours"],
  allowanceAmount: ["allowance", "allowance amount"],
  deductionAmount: ["deduction", "deduction amount"],
  salesAmount: ["sales", "sales amount"],
  targetAmount: ["target", "target amount"]
} as const;

export type PayrollImportField = keyof typeof payrollImportAliases;

export function normalizePayrollHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function detectPayrollImportField(header: string): PayrollImportField | "unmatched" {
  const normalized = normalizePayrollHeader(header);
  for (const [field, aliases] of Object.entries(payrollImportAliases) as Array<[PayrollImportField, readonly string[]]>) {
    if (aliases.includes(normalized)) return field;
  }
  return "unmatched";
}

export function mapPayrollImportHeaders(headers: string[]) {
  const mapped = headers.map((header) => ({ header, targetField: detectPayrollImportField(header) }));
  return {
    mapped,
    unmatchedColumns: mapped.filter((item) => item.targetField === "unmatched").map((item) => item.header)
  };
}
