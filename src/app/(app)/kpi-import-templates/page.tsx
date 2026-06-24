import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function KpiImportTemplatesPage() {
  const principal = await requirePagePermission("kpi_import_template.view");
  const templates = await prisma.kpiImportTemplate.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>KPI Import Templates</h2><p>Reusable mappings for manual KPI import automation.</p></div></header>
      {hasPermission(principal, "kpi_import_template.manage") && <AsyncForm action="/api/kpi-import-templates"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label className="wide">Field mapping JSON<textarea className="textarea" name="fieldMapping" defaultValue={'{"Employee ID":"employeeId","Metric":"metric","Actual":"actualValue"}'} required /></label><label className="wide">Description<textarea className="textarea" name="description" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Templates</h3><span>{templates.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{templates.map((template) => <div className="mini-card" key={template.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{template.name}</strong><Badge tone={template.activeStatus ? "green" : "neutral"}>{template.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge></div></div>)}</div></section>
    </>
  );
}
