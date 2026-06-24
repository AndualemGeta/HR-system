import { EmployeeRole } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function KpiEvaluationLinkagePage() {
  await requirePagePermission("kpi_evaluation_linkage.manage");
  const [weights, metrics] = await Promise.all([
    prisma.kpiEvaluationWeight.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.kpiMetric.findMany({ where: { activeStatus: true }, orderBy: { name: "asc" }, take: 200 })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>KPI Evaluation Linkage</h2><p>Approved KPI results can support evaluations through controlled weights.</p></div></header>
      <AsyncForm action="/api/kpi-evaluation-weights"><div className="form-grid"><label>Metric<select className="select" name="metricId">{metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.name}</option>)}</select></label><label>Role<select className="select" name="applicableRole" defaultValue=""><option value="">Any</option>{Object.values(EmployeeRole).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Weight<input className="field" name="weight" type="number" step="0.01" required /></label></div></AsyncForm>
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Weights</h3><span>{weights.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{weights.map((weight) => <div className="mini-card" key={weight.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{weight.metricId}</strong><Badge tone={weight.activeStatus ? "green" : "neutral"}>{weight.weight.toString()}%</Badge></div><span>{weight.applicableRole ?? "Any role"}</span></div>)}</div></section>
    </>
  );
}
