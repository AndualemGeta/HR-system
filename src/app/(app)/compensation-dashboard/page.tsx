import { Badge } from "@/components/ui/badge";
import { canViewCommissionForEmployee, canViewPayrollInput, canViewRestrictedCompensation, canViewSalaryReviewForEmployee } from "@/lib/phase45-access";
import { prisma } from "@/lib/prisma";
import { employeeScopeSelect, filterEmployeeIdLinkedRecords, visibleEmployeeIds } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function CompensationDashboardPage() {
  const principal = await requirePagePermission("compensation_dashboard.view");
  const [allSalaryReviews, allCommissionCalculations, allPayrollRows, allValidationIssues, employees] = await Promise.all([
    prisma.salaryReview.findMany({ take: 1000 }),
    prisma.commissionCalculation.findMany({ take: 1000 }),
    prisma.payrollPreparationRow.findMany({ take: 1000 }),
    prisma.payrollValidationIssue.findMany({ take: 1000 }),
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { employeeId: "asc" }, take: 1000 })
  ]);
  const salaryReviews = filterEmployeeIdLinkedRecords(principal, allSalaryReviews, employees, canViewSalaryReviewForEmployee);
  const commissionCalculations = filterEmployeeIdLinkedRecords(principal, allCommissionCalculations, employees, canViewCommissionForEmployee);
  const payrollRows = filterEmployeeIdLinkedRecords(principal, allPayrollRows, employees, canViewPayrollInput);
  const payrollEmployeeIds = visibleEmployeeIds(principal, employees, canViewPayrollInput);
  const validationIssues = allValidationIssues.filter((issue) =>
    issue.employeeId ? payrollEmployeeIds.has(issue.employeeId) : canViewRestrictedCompensation(principal)
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Compensation Dashboard</h2>
          <p>Salary reviews, commission approvals, payroll warnings, blockers, and employer payroll cost.</p>
        </div>
      </header>

      <div className="grid stats">
        <div className="stat-card card"><span className="label">Salary Reviews</span><span className="value">{salaryReviews.length}</span><span className="meta">{salaryReviews.filter((review) => ["SUBMITTED", "HR_REVIEW", "FINANCE_REVIEW"].includes(review.status)).length} pending</span></div>
        <div className="stat-card card"><span className="label">Commission</span><span className="value">{commissionCalculations.length}</span><span className="meta">{commissionCalculations.filter((calculation) => calculation.calculationStatus === "APPROVED").length} approved</span></div>
        <div className="stat-card card"><span className="label">Warnings</span><span className="value">{payrollRows.filter((row) => Array.isArray(row.payrollWarnings) && row.payrollWarnings.length > 0).length}</span><span className="meta">Payroll rows</span></div>
        <div className="stat-card card"><span className="label">Blockers</span><span className="value">{validationIssues.filter((issue) => issue.severity === "BLOCKER" && !["RESOLVED", "DISMISSED"].includes(issue.status)).length}</span><span className="meta">Open issues</span></div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <ReportGroup title="Salary reviews by status" rows={countBy(salaryReviews.map((review) => review.status))} />
        <ReportGroup title="Commission by status" rows={countBy(commissionCalculations.map((calculation) => calculation.calculationStatus))} />
        <ReportGroup title="Payroll blockers by type" rows={countBy(validationIssues.filter((issue) => issue.severity === "BLOCKER").map((issue) => issue.issueType))} />
        <section className="panel">
          <div className="panel-header"><h3>Employer Cost</h3><Badge tone="blue">Calculated</Badge></div>
          <div className="mini-card"><span>Total payroll cost</span><strong>{payrollRows.reduce((sum, row) => sum + (row.employerTotalCost?.toNumber() ?? 0), 0).toFixed(2)}</strong></div>
        </section>
      </div>
    </>
  );
}

function ReportGroup({ title, rows }: Readonly<{ title: string; rows: Array<{ label: string; value: number }> }>) {
  return (
    <section className="panel">
      <div className="panel-header"><h3>{title}</h3><span>{rows.length} groups</span></div>
      <div className="grid" style={{ gap: 8 }}>
        {rows.map((row) => <div className="mini-card" key={row.label} style={{ display: "flex", justifyContent: "space-between" }}><strong>{row.label}</strong><span>{row.value}</span></div>)}
      </div>
    </section>
  );
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}
