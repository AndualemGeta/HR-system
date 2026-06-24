import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("compensation_dashboard.view");
  if (isApiError(principal)) return principal;
  const [salaryReviews, commissionCalculations, payrollRows, validationIssues, allowances, deductions] = await Promise.all([
    prisma.salaryReview.findMany({ take: 1000 }),
    prisma.commissionCalculation.findMany({ take: 1000 }),
    prisma.payrollPreparationRow.findMany({ take: 1000 }),
    prisma.payrollValidationIssue.findMany({ take: 1000 }),
    prisma.payrollAllowance.findMany({ take: 1000 }),
    prisma.payrollDeduction.findMany({ take: 1000 })
  ]);
  const dashboard = {
    salaryReviewsByStatus: countBy(salaryReviews.map((review) => review.status)),
    commissionByStatus: countBy(commissionCalculations.map((calculation) => calculation.calculationStatus)),
    payrollRowsWithCommission: payrollRows.filter((row) => row.approvedCommission && row.approvedCommission.toNumber() > 0).length,
    payrollRowsWithWarnings: payrollRows.filter((row) => Array.isArray(row.payrollWarnings) && row.payrollWarnings.length > 0).length,
    payrollBlockersByType: countBy(validationIssues.filter((issue) => issue.severity === "BLOCKER").map((issue) => issue.issueType)),
    allowanceSummaryByType: sumByType(allowances.map((allowance) => ({ type: allowance.allowanceType, amount: allowance.amount.toNumber() }))),
    deductionSummaryByType: sumByType(deductions.map((deduction) => ({ type: deduction.deductionType, amount: deduction.amount.toNumber() }))),
    employerTotalPayrollCost: payrollRows.reduce((sum, row) => sum + (row.employerTotalCost?.toNumber() ?? 0), 0)
  };
  await writeAuditLog({ userId: principal.id, action: "COMPENSATION_REPORT_VIEW", entityType: "CompensationDashboard", newValue: { sections: Object.keys(dashboard) } });
  return NextResponse.json({ dashboard });
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function sumByType(rows: Array<{ type: string; amount: number }>) {
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.type, Math.round(((sums.get(row.type) ?? 0) + row.amount) * 100) / 100);
  return [...sums.entries()].map(([label, value]) => ({ label, value }));
}
