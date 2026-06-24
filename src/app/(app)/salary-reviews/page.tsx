import { SalaryReviewStatus } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewRestrictedCompensation, redactMoney } from "@/lib/phase45-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SalaryReviewsPage() {
  const principal = await requirePagePermission("salary_review.view");
  const [reviews, employees, evaluations] = await Promise.all([
    prisma.salaryReview.findMany({ include: { employee: { select: { employeeId: true, fullName: true } }, relatedEvaluation: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.employee.findMany({ select: { id: true, employeeId: true, fullName: true }, orderBy: { employeeId: "asc" }, take: 300 }),
    prisma.employeeEvaluation.findMany({ where: { status: "APPROVED" }, include: { employee: { select: { employeeId: true, fullName: true } } }, orderBy: { updatedAt: "desc" }, take: 100 })
  ]);

  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Salary Reviews</h2><p>Compensation review requests separated from salary history updates.</p></div></header>

      {hasPermission(principal, "salary_review.create") && (
        <AsyncForm action="/api/salary-reviews">
          <div className="form-grid">
            <label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label>
            <label>Proposed salary<input className="field" name="proposedSalary" type="number" step="0.01" required /></label>
            <label>Effective date<input className="field" name="effectiveDate" type="date" /></label>
            <label>Related evaluation<select className="select" name="relatedEvaluationId" defaultValue=""><option value="">None</option>{evaluations.map((evaluation) => <option key={evaluation.id} value={evaluation.id}>{evaluation.employee.employeeId} - {evaluation.compensationRecommendation}</option>)}</select></label>
            <label>Status<select className="select" name="status" defaultValue="DRAFT">{Object.values(SalaryReviewStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="wide">Reason<textarea className="textarea" name="reason" required /></label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><h3>Review Queue</h3><span>{reviews.length} records</span></div>
        <div className="table-wrap">
          <table><thead><tr><th>Employee</th><th>Status</th><th>Current</th><th>Proposed</th><th>Change</th><th>Actions</th></tr></thead>
            <tbody>{reviews.map((review) => (
              <tr key={review.id}>
                <td><strong>{review.employee.employeeId}</strong><br />{review.employee.fullName}</td>
                <td><Badge tone={review.status === "COMPLETED" ? "green" : review.status === "REJECTED" ? "red" : "amber"}>{review.status}</Badge></td>
                <td>{redactMoney(review.currentSalary, principal)}</td>
                <td>{redactMoney(review.proposedSalary, principal)}</td>
                <td>{redactMoney(review.changeAmount, principal)}</td>
                <td>{canViewRestrictedCompensation(principal) && hasPermission(principal, "salary_review.approve") && !["REJECTED", "COMPLETED"].includes(review.status) && (
                  <div className="toolbar">
                    {(["APPROVED", "REJECTED", "COMPLETED"] as const).map((status) => <AsyncForm action={`/api/salary-reviews/${review.id}`} method="PATCH" className="toolbar" key={status} submitLabel={status}><input name="status" type="hidden" value={status} /></AsyncForm>)}
                  </div>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
