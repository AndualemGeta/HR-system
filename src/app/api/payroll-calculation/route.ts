import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { calculatePayroll } from "@/lib/payroll-calculation";
import { isApprovedEffectivePayrollRule, payrollRuleSetupIssues } from "@/lib/payroll-rule-governance";
import { canRunPayrollCalculation } from "@/lib/phase45-access";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const runSchema = z.object({ batchId: z.string().min(1) });

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_calculation.run");
  if (isApiError(principal)) return principal;
  if (!canRunPayrollCalculation(principal)) return NextResponse.json({ error: "Permission denied for payroll calculation." }, { status: 403 });

  const parsed = runSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll calculation request.", details: parsed.error.flatten() }, { status: 400 });

  const batch = await prisma.payrollPreparationBatch.findUnique({
    where: { id: parsed.data.batchId },
    include: { rows: { include: { employee: true } } }
  });
  if (!batch) return NextResponse.json({ error: "Payroll batch not found." }, { status: 404 });
  if (["APPROVED", "EXPORTED"].includes(batch.status)) {
    return NextResponse.json({ error: "Approved or exported payroll batches cannot be recalculated." }, { status: 422 });
  }

  const periodStart = batch.payrollPeriodStart;
  const periodEnd = batch.payrollPeriodEnd;
  const [rules, payeBrackets, pensionRules, attendanceInputs, allowances, deductions, commissions] = await Promise.all([
    prisma.payrollRule.findMany({ where: { activeStatus: true } }),
    prisma.payeTaxBracket.findMany({ where: { activeStatus: true }, orderBy: { minIncome: "asc" } }),
    prisma.pensionRule.findMany({ where: { activeStatus: true } }),
    prisma.payrollAttendanceInput.findMany({ where: { payrollPeriodStart: periodStart, payrollPeriodEnd: periodEnd, approvalStatus: "APPROVED" } }),
    prisma.payrollAllowance.findMany({ where: { payrollPeriodStart: periodStart, payrollPeriodEnd: periodEnd, approvalStatus: "APPROVED" } }),
    prisma.payrollDeduction.findMany({ where: { payrollPeriodStart: periodStart, payrollPeriodEnd: periodEnd, approvalStatus: "APPROVED" } }),
    prisma.commissionCalculation.findMany({ where: { periodStart, periodEnd, calculationStatus: "APPROVED" }, include: { commissionPlan: true } })
  ]);

  const activePaye = payeBrackets.filter((bracket) => isApprovedEffectivePayrollRule(bracket, periodEnd));
  const activePension = pensionRules.filter((rule) => isApprovedEffectivePayrollRule(rule, periodEnd));
  const approvedRules = rules.filter((rule) => isApprovedEffectivePayrollRule(rule, periodEnd));
  const setupIssues = payrollRuleSetupIssues({
    payeRuleCount: activePaye.length,
    pensionRuleCount: activePension.length,
    overtimeRuleCount: approvedRules.filter((rule) => String(rule.ruleType).startsWith("OVERTIME_")).length,
    workingDayRuleCount: approvedRules.filter((rule) => rule.ruleType === "WORKING_DAYS_DEFAULT").length,
    hasSampleRules: [...rules, ...payeBrackets, ...pensionRules].some((rule) => rule.isSample),
    hasUnapprovedRules: [...rules, ...payeBrackets, ...pensionRules].some((rule) => rule.approvalStatus !== "APPROVED"),
    hasExpiredRules: [...rules, ...payeBrackets, ...pensionRules].some((rule) => rule.effectiveEndDate && rule.effectiveEndDate < periodEnd)
  });
  const overtimeRates = {
    sundayRate: effectiveRuleRate(approvedRules, "OVERTIME_SUNDAY_RATE"),
    holidayRate: effectiveRuleRate(approvedRules, "OVERTIME_HOLIDAY_RATE"),
    nightRate: effectiveRuleRate(approvedRules, "OVERTIME_NIGHT_RATE")
  };
  const defaultWorkingDays = effectiveRuleAmount(approvedRules, "WORKING_DAYS_DEFAULT") ?? 22;

  let readyCount = 0;
  let warningCount = 0;
  let blockedCount = 0;

  await prisma.$transaction(async (tx) => {
    await tx.payrollValidationIssue.deleteMany({ where: { payrollBatchId: batch.id } });

    for (const row of batch.rows) {
      const employee = row.employee;
      const attendance = attendanceInputs.find((input) => input.employeeId === employee.id);
      const employeeAllowances = allowances.filter((allowance) => allowance.employeeId === employee.id);
      const employeeDeductions = deductions.filter((deduction) => deduction.employeeId === employee.id);
      const employeeCommissions = commissions.filter((commission) => commission.employeeId === employee.id);
      const pensionRule = activePension.find((rule) =>
        (!rule.applicableEmploymentType || rule.applicableEmploymentType === employee.employmentType) &&
        (!rule.applicableRole || rule.applicableRole === employee.currentRole)
      ) ?? activePension.find((rule) => !rule.applicableEmploymentType && !rule.applicableRole) ?? null;

      const approvedAllowances = sumDecimal(employeeAllowances.map((allowance) => allowance.amount));
      const approvedDeductions = sumDecimal(employeeDeductions.map((deduction) => deduction.amount));
      const preTaxDeductions = sumDecimal(employeeDeductions.filter((deduction) => deduction.preTaxStatus).map((deduction) => deduction.amount));
      const approvedCommission = sumDecimal(employeeCommissions.map((commission) => commission.finalCommission));
      const basicSalary = employee.basicSalary?.toNumber() ?? 0;
      const calculation = calculatePayroll({
        basicSalary,
        workingDays: attendance?.workingDays.toNumber() ?? defaultWorkingDays,
        daysPresent: attendance?.daysPresent.toNumber() ?? defaultWorkingDays,
        paidLeaveDays: attendance?.paidLeaveDays.toNumber() ?? 0,
        unpaidLeaveDays: attendance?.unpaidLeaveDays.toNumber() ?? 0,
        sundayOvertimeHours: attendance?.sundayOvertimeHours.toNumber() ?? 0,
        holidayOvertimeHours: attendance?.holidayOvertimeHours.toNumber() ?? 0,
        nightOvertimeHours: attendance?.nightOvertimeHours.toNumber() ?? 0,
        approvedAllowances,
        approvedCommission,
        approvedDeductions,
        preTaxDeductions,
        overtimeRates,
        pensionRule: pensionRule
          ? {
              id: pensionRule.id,
              name: pensionRule.name,
              employeeRate: pensionRule.employeeRate.toNumber(),
              employerRate: pensionRule.employerRate.toNumber()
            }
          : null,
        payeBrackets: activePaye.map((bracket) => ({
          id: bracket.id,
          name: bracket.name,
          minIncome: bracket.minIncome.toNumber(),
          maxIncome: bracket.maxIncome?.toNumber() ?? null,
          taxRate: bracket.taxRate.toNumber(),
          deductionAmount: bracket.deductionAmount.toNumber()
        }))
      });

      const warnings = [...setupIssues, ...calculation.warnings];
      if (!attendance) warnings.push({ severity: "BLOCKER" as const, field: "attendance", message: "No approved attendance input exists for this payroll period." });
      const blockers = warnings.filter((warning) => warning.severity === "BLOCKER");
      const readinessStatus = blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "READY";
      if (readinessStatus === "READY") readyCount += 1;
      if (readinessStatus === "WARNING") warningCount += 1;
      if (readinessStatus === "BLOCKED") blockedCount += 1;

      await tx.payrollPreparationRow.update({
        where: { id: row.id },
        data: {
          workingDays: new Prisma.Decimal(calculation.workingDays),
          daysPresent: new Prisma.Decimal(calculation.daysPresent),
          paidLeaveDays: new Prisma.Decimal(calculation.paidLeaveDays),
          unpaidLeaveDays: new Prisma.Decimal(calculation.unpaidLeaveDays),
          proratedBasicSalary: new Prisma.Decimal(calculation.proratedBasicSalary),
          approvedAllowances: new Prisma.Decimal(calculation.totalAllowances),
          approvedCommission: new Prisma.Decimal(calculation.approvedCommission),
          approvedDeductions: new Prisma.Decimal(approvedDeductions),
          overtimeAmount: new Prisma.Decimal(calculation.totalOvertimeAmount),
          grossSalary: new Prisma.Decimal(calculation.grossSalary),
          employeePension: new Prisma.Decimal(calculation.employeePension),
          employerPension: new Prisma.Decimal(calculation.employerPension),
          taxableIncome: new Prisma.Decimal(calculation.taxableIncome),
          payeTax: new Prisma.Decimal(calculation.payeTax),
          netSalary: new Prisma.Decimal(calculation.netSalary),
          employerTotalCost: new Prisma.Decimal(calculation.employerTotalCost),
          payrollWarnings: warnings as unknown as Prisma.InputJsonValue,
          payrollBlockers: blockers as unknown as Prisma.InputJsonValue,
          payrollCalculationBreakdown: calculation as unknown as Prisma.InputJsonValue,
          readinessStatus,
          includedInExport: readinessStatus !== "BLOCKED"
        }
      });

      if (warnings.length > 0) {
        await tx.payrollValidationIssue.createMany({
          data: warnings.map((warning) => ({
            payrollBatchId: batch.id,
            payrollRowId: row.id,
            employeeId: employee.id,
            issueType: issueTypeForField(warning.field),
            severity: warning.severity,
            fieldName: warning.field,
            message: warning.message,
            suggestedFix: "Review payroll setup and approved inputs before approval."
          }))
        });
      }
    }

    await tx.payrollPreparationBatch.update({
      where: { id: batch.id },
      data: { readyCount, warningCount, blockedCount, totalEmployees: batch.rows.length, status: "VALIDATED" }
    });
  });

  await writeAuditLog({
    userId: principal.id,
    action: "PAYROLL_CALCULATION_RUN",
    entityType: "PayrollPreparationBatch",
    entityId: batch.id,
    newValue: { readyCount, warningCount, blockedCount }
  });

  return NextResponse.json({ batchId: batch.id, readyCount, warningCount, blockedCount });
}

function effectiveRuleRate(rules: Array<{ ruleType: string; rate: Prisma.Decimal | null }>, type: string) {
  return rules.find((rule) => rule.ruleType === type)?.rate?.toNumber() ?? 0;
}

function effectiveRuleAmount(rules: Array<{ ruleType: string; amount: Prisma.Decimal | null; value: string | null }>, type: string) {
  const rule = rules.find((candidate) => candidate.ruleType === type);
  return rule?.amount?.toNumber() ?? (rule?.value ? Number(rule.value) : null);
}

function sumDecimal(values: Prisma.Decimal[]) {
  return values.reduce((sum, value) => sum + value.toNumber(), 0);
}

function issueTypeForField(field: string) {
  if (field === "attendance") return "MISSING_ATTENDANCE";
  if (field === "pensionRule") return "MISSING_PENSION_RULE";
  if (field === "payeBrackets") return "MISSING_PAYE_RULE";
  if (field.toLowerCase().includes("overtime")) return "INVALID_OVERTIME";
  return "OTHER";
}
