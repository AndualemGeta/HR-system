import { EmployeeRole, KpiMetricType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewKpiForEmployee, employeeToScope } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function KpiPage() {
  const principal = await requirePagePermission("kpi.view");
  const [metrics, allResults, allEmployees] = await Promise.all([
    prisma.kpiMetric.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 100 }),
    prisma.employeeKpiResult.findMany({
      include: { employee: true, metric: true },
      orderBy: { periodEnd: "desc" },
      take: 100
    }),
    prisma.employee.findMany({ where: { employmentStatus: { in: ["ACTIVE", "ON_PROBATION"] } }, orderBy: { employeeId: "asc" }, take: 300 })
  ]);
  const employees = allEmployees.filter((employee) => canViewKpiForEmployee(principal, employeeToScope(employee)));
  const results = allResults.filter((result) => canViewKpiForEmployee(principal, employeeToScope(result.employee)));

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>KPI Foundation</h2>
          <p>Define KPI metrics, import employee KPI results, calculate achievement, and approve submitted results.</p>
        </div>
      </header>

      <div className="grid two">
        {hasPermission(principal, "kpi.create") && (
          <AsyncForm action="/api/kpi/metrics">
            <div className="form-grid">
              <label>
                Metric name
                <input className="field" name="name" required />
              </label>
              <label>
                Type
                <select className="select" name="metricType">
                  {Object.values(KpiMetricType).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                Unit
                <input className="field" name="unit" placeholder="count, %, ETB" />
              </label>
              <label>
                Applicable role
                <select className="select" name="applicableRole" defaultValue="">
                  <option value="">Any role</option>
                  {Object.values(EmployeeRole).map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label className="wide">
                Description
                <textarea className="textarea" name="description" />
              </label>
            </div>
          </AsyncForm>
        )}

        {hasPermission(principal, "kpi.import") && (
          <AsyncForm action="/api/kpi/results">
            <div className="form-grid">
              <label>
                Employee
                <select className="select" name="employeeId">
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}
                </select>
              </label>
              <label>
                Metric
                <select className="select" name="metricId">
                  {metrics.filter((metric) => metric.activeStatus).map((metric) => <option key={metric.id} value={metric.id}>{metric.name}</option>)}
                </select>
              </label>
              <label>
                Source
                <input className="field" name="source" placeholder="Manual import" />
              </label>
              <label>
                Period start
                <input className="field" name="periodStart" type="date" required />
              </label>
              <label>
                Period end
                <input className="field" name="periodEnd" type="date" required />
              </label>
              <label>
                Target
                <input className="field" name="targetValue" type="number" step="0.01" />
              </label>
              <label>
                Actual
                <input className="field" name="actualValue" type="number" step="0.01" required />
              </label>
            </div>
          </AsyncForm>
        )}
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <section className="panel">
          <div className="panel-header">
            <h3>Metrics</h3>
            <span>{metrics.length} configured</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {metrics.map((metric) => (
              <div className="mini-card" key={metric.id}>
                <strong>{metric.name}</strong>
                <span>{metric.metricType} / {metric.unit ?? "No unit"} / {metric.applicableRole ?? "All roles"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Recent Results</h3>
            <span>{results.length} rows</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {results.map((result) => (
              <div className="mini-card" key={result.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{result.employee.employeeId} - {result.metric.name}</strong>
                  <Badge tone={result.approvalStatus === "APPROVED" ? "green" : result.approvalStatus === "REJECTED" ? "red" : "amber"}>{result.approvalStatus}</Badge>
                </div>
                <span>Actual {result.actualValue.toString()} / target {result.targetValue?.toString() ?? "n/a"} / rating {result.rating}</span>
                {hasPermission(principal, "kpi.approve") && result.approvalStatus === "SUBMITTED" && (
                  <div className="toolbar" style={{ marginTop: 8 }}>
                    <AsyncForm action="/api/kpi/results" method="PATCH" className="toolbar" submitLabel="Approve">
                      <input name="resultId" type="hidden" value={result.id} />
                      <input name="approvalStatus" type="hidden" value="APPROVED" />
                    </AsyncForm>
                    <AsyncForm action="/api/kpi/results" method="PATCH" className="toolbar" submitLabel="Reject">
                      <input name="resultId" type="hidden" value={result.id} />
                      <input name="approvalStatus" type="hidden" value="REJECTED" />
                    </AsyncForm>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
