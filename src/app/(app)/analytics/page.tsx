import { Badge } from "@/components/ui/badge";
import { getPhase4Analytics } from "@/lib/phase4-reports";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function AnalyticsPage() {
  const principal = await requirePagePermission("analytics.view");
  const analytics = await getPhase4Analytics(principal);

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Analytics</h2>
          <p>Scoped operational analytics across payroll readiness, KPI results, data quality, reminders, profile changes, and approval governance.</p>
        </div>
      </header>

      <div className="grid stats">
        <div className="stat-card card"><span className="label">Headcount</span><span className="value">{analytics.headcount}</span><span className="meta">{analytics.activeEmployees} active</span></div>
        <div className="stat-card card"><span className="label">KPI Achievement</span><span className="value">{analytics.averageKpiAchievement}%</span><span className="meta">Approved and submitted rows</span></div>
        <div className="stat-card card"><span className="label">Open Quality</span><span className="value">{analytics.openDataQualityIssues}</span><span className="meta">Unresolved issues</span></div>
        <div className="stat-card card"><span className="label">Escalations</span><span className="value">{analytics.approvalEscalationCandidates}</span><span className="meta">{analytics.governancePending} pending approvals</span></div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <ReportGroup title="Payroll readiness" rows={analytics.payrollReadiness} />
        <ReportGroup title="KPI ratings" rows={analytics.kpiRatings} />
        <ReportGroup title="Data quality severity" rows={analytics.dataQualityBySeverity} />
        <ReportGroup title="Reminder status" rows={analytics.remindersByStatus} />
        <ReportGroup title="Profile change status" rows={analytics.profileChangesByStatus} />
        <ReportGroup title="Export history" rows={analytics.exportHistoryByType} />
      </div>

      {analytics.latestPayrollBatch && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <h3>Latest Payroll Batch</h3>
            <Badge tone={analytics.latestPayrollBatch.status === "APPROVED" || analytics.latestPayrollBatch.status === "EXPORTED" ? "green" : "amber"}>{analytics.latestPayrollBatch.status}</Badge>
          </div>
          <div className="matrix">
            <div className="mini-card"><span>Batch</span><strong>{analytics.latestPayrollBatch.batchName}</strong></div>
            <div className="mini-card"><span>Total</span><strong>{analytics.latestPayrollBatch.totalEmployees}</strong></div>
            <div className="mini-card"><span>Ready</span><strong>{analytics.latestPayrollBatch.readyCount}</strong></div>
            <div className="mini-card"><span>Blocked</span><strong>{analytics.latestPayrollBatch.blockedCount}</strong></div>
          </div>
        </section>
      )}
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
          <div className="mini-card" key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <strong>{row.label}</strong>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
