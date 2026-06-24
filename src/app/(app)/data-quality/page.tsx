import { DataQualityIssueType, DataQualitySeverity, DataQualityStatus } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewDataQualityIssue, employeeToScope } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function DataQualityPage() {
  const principal = await requirePagePermission("data_quality.view");
  const [allIssues, allEmployees, users] = await Promise.all([
    prisma.dataQualityIssue.findMany({
      include: { employee: true },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
      take: 200
    }),
    prisma.employee.findMany({ orderBy: { employeeId: "asc" }, take: 300 }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 100 })
  ]);
  const issues = allIssues.filter((issue) => canViewDataQualityIssue(principal, issue.employee ? employeeToScope(issue.employee) : undefined));
  const employees = allEmployees.filter((employee) => canViewDataQualityIssue(principal, employeeToScope(employee)));

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Data Quality</h2>
          <p>Track record blockers, assignment problems, missing documents, payroll readiness issues, and resolution ownership.</p>
        </div>
      </header>

      {hasPermission(principal, "data_quality.assign") && (
        <AsyncForm action="/api/data-quality">
          <div className="form-grid">
            <label>
              Type
              <select className="select" name="issueType">{Object.values(DataQualityIssueType).map((type) => <option key={type} value={type}>{type}</option>)}</select>
            </label>
            <label>
              Severity
              <select className="select" name="severity">{Object.values(DataQualitySeverity).map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select>
            </label>
            <label>
              Employee
              <select className="select" name="employeeId" defaultValue="">
                <option value="">System level</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}
              </select>
            </label>
            <label>
              Assign to
              <select className="select" name="assignedToId" defaultValue="">
                <option value="">Unassigned</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label className="wide">
              Description
              <textarea className="textarea" name="description" required />
            </label>
            <label className="wide">
              Suggested fix
              <textarea className="textarea" name="suggestedFix" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Issues</h3>
          <span>{issues.length} tracked</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {issues.map((issue) => (
            <div className="mini-card" key={issue.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{issue.issueType}</strong>
                <Badge tone={issue.severity === "BLOCKER" ? "red" : issue.severity === "WARNING" ? "amber" : "blue"}>{issue.severity}</Badge>
              </div>
              <span>{issue.employee ? `${issue.employee.employeeId} - ${issue.employee.fullName}` : "System level"} / {issue.status}</span>
              <p>{issue.description}</p>
              {hasPermission(principal, "data_quality.resolve") && !["RESOLVED", "DISMISSED"].includes(issue.status) && (
                <div className="toolbar">
                  {(["RESOLVED", "DISMISSED"] as DataQualityStatus[]).map((status) => (
                    <AsyncForm action={`/api/data-quality/${issue.id}`} method="PATCH" className="toolbar" key={status}>
                      <input name="status" type="hidden" value={status} />
                      <span>{status}</span>
                    </AsyncForm>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
