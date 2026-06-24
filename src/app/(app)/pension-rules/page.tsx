import { EmployeeRole, EmploymentType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PensionRulesPage() {
  const principal = await requirePagePermission("pension_rule.view");
  const rules = await prisma.pensionRule.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Pension Rules</h2><p>Configurable employee and employer pension rates by employment type or role.</p></div></header>
      {hasPermission(principal, "pension_rule.manage") && <AsyncForm action="/api/pension-rules"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Employee rate<input className="field" name="employeeRate" type="number" step="0.0001" required /></label><label>Employer rate<input className="field" name="employerRate" type="number" step="0.0001" required /></label><label>Employment type<select className="select" name="applicableEmploymentType" defaultValue=""><option value="">Any</option>{Object.values(EmploymentType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Role<select className="select" name="applicableRole" defaultValue=""><option value="">Any</option>{Object.values(EmployeeRole).map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label>Start<input className="field" name="effectiveStartDate" type="date" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Rules</h3><span>{rules.length} configured</span></div><div className="grid" style={{ gap: 8 }}>{rules.map((rule) => <div className="mini-card" key={rule.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{rule.name}</strong><Badge tone={rule.activeStatus ? "green" : "neutral"}>{rule.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge></div><span>Employee {rule.employeeRate.toString()} / employer {rule.employerRate.toString()} / {rule.applicableEmploymentType ?? "Any type"} / {rule.applicableRole ?? "Any role"}</span></div>)}</div></section>
    </>
  );
}
