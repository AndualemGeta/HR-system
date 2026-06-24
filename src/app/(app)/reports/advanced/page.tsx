import Link from "next/link";
import { getPhase3Reports } from "@/lib/phase3-reports";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function AdvancedReportsPage() {
  const principal = await requirePagePermission("reports.view");
  const reports = await getPhase3Reports(principal);

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Advanced Reports</h2>
          <p>Phase 3 lifecycle reports for disciplinary, termination, transfer, promotion, approval, and exit trends.</p>
        </div>
        <div className="toolbar">
          <Link className="button secondary" href="/api/exports/advanced-reports">
            CSV
          </Link>
          <Link className="button secondary" href="/api/exports/advanced-reports?format=xlsx">
            XLSX
          </Link>
        </div>
      </header>

      <div className="grid two">
        <ReportGroup title="Disciplinary by status" rows={reports.disciplinaryByStatus} />
        <ReportGroup title="Disciplinary by incident" rows={reports.disciplinaryByIncidentType} />
        <ReportGroup title="Termination by status" rows={reports.terminationByStatus} />
        <ReportGroup title="Transfer by status" rows={reports.transferByStatus} />
        <ReportGroup title="Promotion by status" rows={reports.promotionByStatus} />
        <ReportGroup title="Approvals pending by approver" rows={reports.approvalRequestsPendingByApprover} />
        <ReportGroup title="Repeated disciplinary records" rows={reports.repeatedDisciplinaryEmployees} />
        <ReportGroup title="Lifecycle summary" rows={reports.employeeLifecycleSummary} />
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Operational Indicators</h3>
          <span>Scoped to your access</span>
        </div>
        <div className="matrix">
          <div className="mini-card"><span>Open follow-ups</span><strong>{reports.openDisciplinaryFollowUps}</strong></div>
          <div className="mini-card"><span>Clearance pending</span><strong>{reports.exitClearancePending}</strong></div>
          <div className="mini-card"><span>Final payment pending</span><strong>{reports.finalPaymentPending}</strong></div>
          <div className="mini-card"><span>Approval turnaround days</span><strong>{reports.approvalTurnaroundDays}</strong></div>
          <div className="mini-card"><span>Exit completion days</span><strong>{reports.exitCompletionTimeDays}</strong></div>
        </div>
      </section>
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
          <div className="mini-card" key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{row.label}</strong>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
