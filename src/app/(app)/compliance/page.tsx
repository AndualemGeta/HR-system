import { Badge } from "@/components/ui/badge";
import { getPhase4Compliance } from "@/lib/phase4-reports";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function CompliancePage() {
  const principal = await requirePagePermission("compliance.view");
  const compliance = await getPhase4Compliance(principal);

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Compliance</h2>
          <p>Control dashboard for employee record completeness, payroll blockers, overdue reminders, workflow governance, and open data quality issues.</p>
        </div>
      </header>

      <div className="grid stats">
        <div className="stat-card card"><span className="label">Findings</span><span className="value">{compliance.generatedFindings.length}</span><span className="meta">Generated checks</span></div>
        <div className="stat-card card"><span className="label">Payroll Blockers</span><span className="value">{compliance.payrollBlockedRows}</span><span className="meta">Blocked readiness rows</span></div>
        <div className="stat-card card"><span className="label">Overdue</span><span className="value">{compliance.overdueReminders}</span><span className="meta">Reminder follow-ups</span></div>
        <div className="stat-card card"><span className="label">Workflow Gaps</span><span className="value">{compliance.workflowsWithoutEscalation}</span><span className="meta">Active without escalation</span></div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <ReportGroup title="Generated severity" rows={compliance.generatedBySeverity} />
        <ReportGroup title="Open issue severity" rows={compliance.openIssuesBySeverity} />
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Generated Findings</h3>
          <span>{compliance.generatedFindings.length} latest</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {compliance.generatedFindings.map((finding) => (
                <tr key={`${finding.employeeId}-${finding.issueType}-${finding.description}`}>
                  <td><strong>{finding.employeeCode}</strong><br />{finding.employee}</td>
                  <td>{finding.issueType}</td>
                  <td><Badge tone={finding.severity === "BLOCKER" ? "red" : finding.severity === "WARNING" ? "amber" : "blue"}>{finding.severity}</Badge></td>
                  <td>{finding.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
