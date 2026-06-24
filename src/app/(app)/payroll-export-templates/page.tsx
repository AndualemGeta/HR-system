import { PayrollExportFormat, PayrollExportTargetSystem } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollExportTemplatesPage() {
  const principal = await requirePagePermission("payroll_export_template.view");
  const templates = await prisma.payrollExportTemplate.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Export Templates</h2><p>Map approved payroll rows into CSV, XLSX, or JSON layouts without triggering payments.</p></div></header>
      {hasPermission(principal, "payroll_export_template.create") && <AsyncForm action="/api/payroll-export-templates"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Format<select className="select" name="exportFormat">{Object.values(PayrollExportFormat).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Target<select className="select" name="targetSystem">{Object.values(PayrollExportTargetSystem).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="wide">Field mapping JSON<textarea className="textarea" name="fieldMapping" defaultValue={'{"employeeId":"Employee ID","fullName":"Name","netSalary":"Net Salary"}'} required /></label><label className="wide">Description<textarea className="textarea" name="description" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Templates</h3><span>{templates.length} configured</span></div><div className="grid" style={{ gap: 8 }}>{templates.map((template) => <div className="mini-card" key={template.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{template.name}</strong><Badge tone={template.activeStatus ? "green" : "neutral"}>{template.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge></div><span>{template.exportFormat} / {template.targetSystem}</span></div>)}</div></section>
    </>
  );
}
