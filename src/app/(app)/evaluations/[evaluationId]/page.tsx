import { notFound } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canViewEmployee, hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function EvaluationDetailPage({ params }: { params: Promise<{ evaluationId: string }> }) {
  const principal = await requirePagePermission("evaluation.view");
  const { evaluationId } = await params;
  const evaluation = await prisma.employeeEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          currentRole: true,
          currentDepartmentId: true,
          currentRegionId: true,
          currentShopId: true,
          currentClusterId: true,
          directManagerId: true
        }
      },
      evaluator: { select: { employeeId: true, fullName: true } },
      scoreItems: { include: { criteria: true } },
      salaryReviews: { orderBy: { createdAt: "desc" }, take: 10 },
      commissionCalculations: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });

  if (!evaluation) notFound();

  const canView =
    hasPermission(principal, "evaluation.view_all") ||
    canViewEmployee(principal, {
      id: evaluation.employee.id,
      currentRole: evaluation.employee.currentRole,
      currentDepartmentId: evaluation.employee.currentDepartmentId,
      currentRegionId: evaluation.employee.currentRegionId,
      currentShopId: evaluation.employee.currentShopId,
      currentClusterId: evaluation.employee.currentClusterId,
      directManagerId: evaluation.employee.directManagerId
    });

  if (!canView) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "EmployeeEvaluation", entityId: evaluation.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { timestamp: "desc" },
    take: 10
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>
            {evaluation.employee.employeeId} - {evaluation.employee.fullName}
          </h2>
          <p>
            {evaluation.evaluationType} / {evaluation.evaluationPeriodStart.toLocaleDateString()} to{" "}
            {evaluation.evaluationPeriodEnd.toLocaleDateString()}
          </p>
        </div>
        <Badge tone={evaluation.status === "APPROVED" ? "green" : evaluation.status === "REJECTED" ? "red" : "amber"}>
          {evaluation.status}
        </Badge>
      </header>

      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h3>Evaluation Detail</h3>
            <span>{evaluation.rating ?? "Unrated"}</span>
          </div>
          <div className="matrix">
            <div className="mini-card">
              <span>Evaluator</span>
              <strong>
                {evaluation.evaluator.employeeId} - {evaluation.evaluator.fullName}
              </strong>
            </div>
            <div className="mini-card">
              <span>Score</span>
              <strong>{evaluation.score?.toString() ?? "Not scored"}</strong>
            </div>
            <div className="mini-card">
              <span>Submitted</span>
              <strong>{evaluation.submittedDate?.toLocaleDateString() ?? "Not submitted"}</strong>
            </div>
            <div className="mini-card">
              <span>Reviewed / Approved</span>
              <strong>{evaluation.reviewedById ?? evaluation.approvedById ?? "Pending"}</strong>
            </div>
          </div>
          <ul className="timeline" style={{ marginTop: 16 }}>
            <li>
              <strong>Comments</strong>
              <span>{evaluation.comments ?? "No comments recorded"}</span>
            </li>
            <li>
              <strong>Strengths</strong>
              <span>{evaluation.strengths ?? "No strengths recorded"}</span>
            </li>
            <li>
              <strong>Improvement areas</strong>
              <span>{evaluation.improvementAreas ?? "No improvement areas recorded"}</span>
            </li>
            <li>
              <strong>Attachment</strong>
              <span>{evaluation.attachmentPath ?? "No attachment"}</span>
            </li>
            {hasPermission(principal, "compensation_dashboard.view") && (
              <li>
                <strong>Compensation recommendation</strong>
                <span>
                  {evaluation.compensationRecommendation} / salary review {evaluation.salaryReviewRequired ? "required" : "not required"} / commission review{" "}
                  {evaluation.commissionReviewRequired ? "required" : "not required"}
                </span>
              </li>
            )}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Actions</h3>
            <span>Permissioned workflow</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {evaluation.status === "DRAFT" && hasPermission(principal, "evaluation.update") && (
              <AsyncForm action={`/api/evaluations/${evaluation.id}`} method="PATCH" className="grid">
                <label>
                  Score
                  <input className="field" name="score" type="number" min="0" max="100" step="0.01" defaultValue={evaluation.score?.toString()} />
                </label>
                <label>
                  Rating
                  <select className="select" name="rating" defaultValue={evaluation.rating ?? "GOOD"}>
                    {["EXCELLENT", "VERY_GOOD", "GOOD", "NEEDS_IMPROVEMENT", "POOR"].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Comments
                  <textarea className="textarea" name="comments" defaultValue={evaluation.comments ?? ""} />
                </label>
                {hasPermission(principal, "compensation_dashboard.view") && (
                  <>
                    <label>
                      Compensation recommendation
                      <select className="select" name="compensationRecommendation" defaultValue={evaluation.compensationRecommendation}>
                        {[
                          "NO_CHANGE",
                          "SALARY_INCREASE_RECOMMENDED",
                          "SALARY_DECREASE_RECOMMENDED",
                          "BONUS_RECOMMENDED",
                          "COMMISSION_ADJUSTMENT_RECOMMENDED",
                          "PROMOTION_RECOMMENDED",
                          "PERFORMANCE_IMPROVEMENT_PLAN",
                          "OTHER"
                        ].map((recommendation) => (
                          <option key={recommendation} value={recommendation}>
                            {recommendation}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Salary review
                      <select className="select" name="salaryReviewRequired" defaultValue={String(evaluation.salaryReviewRequired)}>
                        <option value="false">Not required</option>
                        <option value="true">Required</option>
                      </select>
                    </label>
                    <label>
                      Commission review
                      <select className="select" name="commissionReviewRequired" defaultValue={String(evaluation.commissionReviewRequired)}>
                        <option value="false">Not required</option>
                        <option value="true">Required</option>
                      </select>
                    </label>
                  </>
                )}
              </AsyncForm>
            )}

            {evaluation.status === "DRAFT" && hasPermission(principal, "evaluation.submit") && (
              <AsyncForm action={`/api/evaluations/${evaluation.id}`} method="PATCH" className="toolbar" submitLabel="Submit evaluation">
                <input name="status" type="hidden" value="SUBMITTED" />
              </AsyncForm>
            )}

            {evaluation.status === "SUBMITTED" && hasPermission(principal, "evaluation.review") && (
              <AsyncForm action={`/api/evaluations/${evaluation.id}`} method="PATCH" className="toolbar" submitLabel="Mark reviewed">
                <input name="status" type="hidden" value="REVIEWED" />
              </AsyncForm>
            )}

            {["SUBMITTED", "REVIEWED"].includes(evaluation.status) && hasPermission(principal, "evaluation.approve") && (
              <>
                <AsyncForm action={`/api/evaluations/${evaluation.id}`} method="PATCH" className="toolbar" submitLabel="Approve">
                  <input name="status" type="hidden" value="APPROVED" />
                </AsyncForm>
                <AsyncForm action={`/api/evaluations/${evaluation.id}`} method="PATCH" className="toolbar" submitLabel="Reject">
                  <input name="status" type="hidden" value="REJECTED" />
                </AsyncForm>
              </>
            )}
          </div>
        </section>
      </div>

      {hasPermission(principal, "compensation_dashboard.view") && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <h3>Compensation Links</h3>
            <span>Salary review and commission follow-up</span>
          </div>
          <div className="matrix">
            <div className="mini-card">
              <span>Salary reviews</span>
              <strong>{evaluation.salaryReviews.length}</strong>
            </div>
            <div className="mini-card">
              <span>Commission calculations</span>
              <strong>{evaluation.commissionCalculations.length}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Audit History</h3>
          <span>{auditLogs.length} events</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {auditLogs.map((log) => (
            <div className="mini-card" key={log.id}>
              <strong>{log.action}</strong>
              <span>
                {log.user?.email ?? "System"} - {log.timestamp.toLocaleString()}
              </span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="mini-card">
              <strong>No audit events</strong>
              <span>Evaluation workflow actions will appear here.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
