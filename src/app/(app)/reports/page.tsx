import { Download } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { getDashboardMetrics } from "@/lib/reports";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ReportsPage() {
  const principal = await requirePagePermission("reports.view");
  const metrics = await getDashboardMetrics(principal);
  const cards = [
    { label: "Total employees", value: metrics.totalEmployees, meta: "All records" },
    { label: "Active employees", value: metrics.activeEmployees, meta: "Current workforce" },
    { label: "Onboarding pending", value: metrics.onboardingPending, meta: "Checklist open" },
    { label: "Missing manager", value: metrics.missingManagerCount, meta: "Needs reporting assignment" },
    { label: "Missing employment type", value: metrics.missingEmploymentTypeCount, meta: "Blocks activation" },
    { label: "Salary-ready", value: metrics.salaryReadyEmployeeCount, meta: "Ready for payroll review" },
    { label: "Missing contracts", value: metrics.employeesMissingRequiredDocuments, meta: "Document follow-up" },
    { label: "Pending evaluations", value: metrics.pendingEvaluations, meta: "Draft/submitted/reviewed" },
    { label: "Overdue evaluations", value: metrics.overdueEvaluations, meta: "Past period end" }
  ];

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Reports</h2>
          <p>Phase 1 and Phase 2 employee, import, document, leave, achievement, and evaluation reports.</p>
        </div>
        <Link className="button secondary" href="/api/reports" target="_blank">
          <Download size={16} aria-hidden="true" />
          Export
        </Link>
      </header>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid two">
        <ReportGroup title="Employees by division" rows={metrics.byDivision} />
        <ReportGroup title="Employees by department" rows={metrics.byDepartment} />
        <ReportGroup title="Employees by region" rows={metrics.byRegion} />
        <ReportGroup title="Employees by shop" rows={metrics.byShop} />
        <ReportGroup title="Employees by role" rows={metrics.byRole} />
        <ReportGroup title="Employees by employment type" rows={metrics.byEmploymentType} />
        <ReportGroup title="Import validation issues" rows={metrics.importValidationIssues} />
        <ReportGroup title="Documents by type" rows={metrics.documentsByType} />
        <ReportGroup title="Leave by status" rows={metrics.leaveByStatus} />
        <ReportGroup title="Leave by department" rows={metrics.leaveByDepartment} />
        <ReportGroup title="Leave by shop" rows={metrics.leaveByShop} />
        <ReportGroup title="Achievements by employee" rows={metrics.achievementsByEmployee} />
        <ReportGroup title="Achievements by department" rows={metrics.achievementsByDepartment} />
        <ReportGroup title="Achievements by shop" rows={metrics.achievementsByShop} />
        <ReportGroup title="Evaluations by status" rows={metrics.evaluationByStatus} />
        <ReportGroup title="Evaluations by rating" rows={metrics.evaluationByRating} />
      </div>
    </>
  );
}

function ReportGroup({ title, rows }: Readonly<{ title: string; rows: Array<{ label: string; value: number }> }>) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <span>{rows.length} groups</span>
      </div>
      <div className="grid" style={{ gap: 8 }}>
        {rows.map((row) => (
          <div className="mini-card" key={row.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <strong>{row.label}</strong>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
