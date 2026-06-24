import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollValidationPage() {
  const principal = await requirePagePermission("payroll_validation.view");
  const issues = await prisma.payrollValidationIssue.findMany({ include: { employee: { select: { employeeId: true, fullName: true } }, payrollBatch: { select: { batchName: true } } }, orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Validation</h2><p>Payroll blockers, warnings, and review issues from readiness and calculation checks.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Issues</h3><span>{issues.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Employee</th><th>Issue</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id}><td>{issue.payrollBatch?.batchName ?? "No batch"}</td><td>{issue.employee ? `${issue.employee.employeeId} - ${issue.employee.fullName}` : "System"}</td><td><strong>{issue.issueType}</strong><br />{issue.message}</td><td><Badge tone={issue.severity === "BLOCKER" ? "red" : issue.severity === "WARNING" ? "amber" : "blue"}>{issue.severity}</Badge></td><td>{issue.status}</td><td>{hasPermission(principal, "payroll_validation.resolve") && !["RESOLVED", "DISMISSED"].includes(issue.status) && <AsyncForm action="/api/payroll-validation" method="PATCH" className="toolbar" submitLabel="Resolve"><input name="issueId" type="hidden" value={issue.id} /><input name="status" type="hidden" value="RESOLVED" /></AsyncForm>}</td></tr>)}</tbody></table></div></section>
    </>
  );
}
