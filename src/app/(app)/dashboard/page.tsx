import Link from "next/link";
import { ArrowRight, Download, Plus, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { orgTimeline } from "@/lib/demo-data";
import { getDashboardMetrics } from "@/lib/reports";
import { requirePagePermission } from "@/lib/security/page-auth";

type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
type RecentEmployee = DashboardMetrics["recentlyAddedEmployees"][number];

const employeeColumns: TableColumn<RecentEmployee>[] = [
  { key: "employeeId", header: "Employee ID" },
  { key: "fullName", header: "Name" },
  { key: "currentRole", header: "Role" },
  {
    key: "employmentStatus",
    header: "Status",
    render: (row) => (
      <Badge tone={row.employmentStatus === "ACTIVE" ? "green" : "amber"}>{row.employmentStatus}</Badge>
    )
  }
];

export default async function DashboardPage() {
  const principal = await requirePagePermission("reports.view");
  const metrics = await getDashboardMetrics(principal);
  const dashboardStats = [
    { label: "Total employees", value: metrics.totalEmployees, meta: "All master records" },
    { label: "Active employees", value: metrics.activeEmployees, meta: "Currently active" },
    { label: "Onboarding pending", value: metrics.onboardingPending, meta: "Checklist or activation open" },
    { label: "Missing manager", value: metrics.missingManagerCount, meta: "Requires reporting cleanup" },
    { label: "Missing employment type", value: metrics.missingEmploymentTypeCount, meta: "Blocks activation" },
    { label: "Salary-ready", value: metrics.salaryReadyEmployeeCount, meta: "Active/probation with salary" }
  ];
  const attentionItems = [
    {
      label: "Missing manager",
      value: metrics.missingManagerCount,
      href: "/data-quality",
      detail: "Employees that need reporting cleanup"
    },
    {
      label: "Missing employment type",
      value: metrics.missingEmploymentTypeCount,
      href: "/employees",
      detail: "Blocks clean activation and payroll readiness"
    },
    {
      label: "Missing contract",
      value: metrics.employeesMissingRequiredDocuments,
      href: "/compliance",
      detail: "Document compliance review"
    },
    {
      label: "Overdue evaluations",
      value: metrics.overdueEvaluations,
      href: "/evaluations",
      detail: "Performance workflow follow-up"
    }
  ];
  const workflowLinks = [
    ["Create employee", "Add a new employee with onboarding basics", "/employees/new"],
    ["Prepare payroll", "Validate payroll rows and blockers", "/payroll-preparation"],
    ["Record attendance", "Enter or review daily attendance", "/attendance-records"],
    ["Review approvals", "Act on open HR workflow requests", "/approvals"],
    ["Run reports", "Headcount, compliance, payroll readiness", "/reports"],
    ["Production checklist", "Confirm launch readiness items", "/production-readiness"]
  ];

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Dashboard</h2>
          <p>Core employee, onboarding, assignment, salary readiness, and structure controls for Leapfrog Software Technology Africa PLC.</p>
        </div>
        <div className="toolbar">
          <Link className="button" href="/employees/new">
            <Plus size={16} aria-hidden="true" />
            Employee
          </Link>
        </div>
      </header>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <section className="panel command-panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <h3>Needs Attention</h3>
            <span>Business issues to clear before they become payroll or compliance blockers</span>
          </div>
          <ShieldAlert size={18} aria-hidden="true" />
        </div>
        <div className="workflow-grid">
          {attentionItems.map((item) => (
            <Link className={`workflow-card${item.value > 0 ? " needs-attention" : ""}`} href={item.href} key={item.label}>
              <div className="row-between">
                <strong>{item.label}</strong>
                <span className="workflow-count">{item.value}</span>
              </div>
              <p>{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel command-panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <h3>Common Workflows</h3>
            <span>Shortcuts for the tasks HR, Finance, and managers repeat most</span>
          </div>
        </div>
        <div className="workflow-grid">
          {workflowLinks.map(([label, detail, href]) => (
            <Link className="workflow-card" href={href} key={href}>
              <div className="row-between">
                <strong>{label}</strong>
                <ArrowRight size={16} aria-hidden="true" />
              </div>
              <p>{detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Employee Master Data</h3>
              <span>Recent records</span>
            </div>
            <Link className="button secondary" href="/reports">
              <Download size={16} aria-hidden="true" />
              Export
            </Link>
          </div>
          <DataTable columns={employeeColumns} rows={metrics.recentlyAddedEmployees} />
        </section>

        <div className="grid">
          <section className="panel">
            <div className="panel-header">
              <h3>Default Structure</h3>
              <span>Seed hierarchy</span>
            </div>
            <ul className="timeline">
              {orgTimeline.map(([title, detail]) => (
                <li key={title}>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Report Breakdowns</h3>
              <span>Phase 1 metrics</span>
            </div>
            <div className="matrix">
              {[
                ["Roles", metrics.byRole.length],
                ["Departments", metrics.byDepartment.length],
                ["Regions", metrics.byRegion.length],
                ["Shops", metrics.byShop.length]
              ].map(([label, value]) => (
                <div className="mini-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
