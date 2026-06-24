import { EvaluationType } from "@prisma/client";
import Link from "next/link";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canEvaluateEmployee, canViewEmployee, hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function EvaluationsPage() {
  const principal = await requirePagePermission("evaluation.view");
  const [evaluations, allEmployees] = await Promise.all([
    prisma.employeeEvaluation.findMany({
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
        evaluator: { select: { employeeId: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.employee.findMany({
      select: employeeScopeSelect,
      orderBy: { fullName: "asc" },
      take: 200
    })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, canEvaluateEmployee);

  const visibleEvaluations = evaluations.filter((evaluation) =>
    hasPermission(principal, "evaluation.view_all")
      ? true
      : canViewEmployee(principal, {
          id: evaluation.employee.id,
          currentRole: evaluation.employee.currentRole,
          currentDepartmentId: evaluation.employee.currentDepartmentId,
          currentRegionId: evaluation.employee.currentRegionId,
          currentShopId: evaluation.employee.currentShopId,
          currentClusterId: evaluation.employee.currentClusterId,
          directManagerId: evaluation.employee.directManagerId
        })
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Evaluations</h2>
          <p>Role and reporting-scope controlled employee evaluations with ratings, status, and review trail.</p>
        </div>
      </header>

      {hasPermission(principal, "evaluation.create") && (
        <AsyncForm action="/api/evaluations">
          <div className="form-grid">
            <label>
              Employee
              <select className="select" name="employeeId" required>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeId} - {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evaluation type
              <select className="select" name="evaluationType" defaultValue="QUARTERLY_PERFORMANCE_REVIEW">
                {Object.values(EvaluationType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period start
              <input className="field" name="evaluationPeriodStart" type="date" required />
            </label>
            <label>
              Period end
              <input className="field" name="evaluationPeriodEnd" type="date" required />
            </label>
            <label>
              Score
              <input className="field" name="score" type="number" min="0" max="100" step="0.01" />
            </label>
            <label>
              Rating
              <select className="select" name="rating" defaultValue="GOOD">
                {["EXCELLENT", "VERY_GOOD", "GOOD", "NEEDS_IMPROVEMENT", "POOR"].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Comments
              <textarea className="textarea" name="comments" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Evaluation History</h3>
          <span>{visibleEvaluations.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleEvaluations.map((evaluation) => (
            <div className="mini-card" key={evaluation.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>
                  <Link href={`/evaluations/${evaluation.id}`}>
                    {evaluation.employee.employeeId} - {evaluation.employee.fullName}
                  </Link>
                </strong>
                <Badge tone={evaluation.status === "APPROVED" ? "green" : "amber"}>{evaluation.status}</Badge>
              </div>
              <span>
                {evaluation.evaluationType} - {evaluation.evaluationPeriodStart.toLocaleDateString()} to{" "}
                {evaluation.evaluationPeriodEnd.toLocaleDateString()}
              </span>
              <span>
                Evaluator: {evaluation.evaluator.employeeId} - {evaluation.evaluator.fullName}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
