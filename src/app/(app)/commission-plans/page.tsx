import { CommissionCalculationType, EmployeeRole, EmploymentType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function CommissionPlansPage() {
  const principal = await requirePagePermission("commission_plan.view");
  const plans = await prisma.commissionPlan.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Commission Plans</h2><p>Effective-dated commission rules for fixed, percent-of-sales, target-based, manual, and deferred tiered plans.</p></div></header>
      {hasPermission(principal, "commission_plan.create") && <AsyncForm action="/api/commission-plans"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Type<select className="select" name="calculationType">{Object.values(CommissionCalculationType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Role<select className="select" name="applicableRole" defaultValue=""><option value="">Any</option>{Object.values(EmployeeRole).map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label>Employment type<select className="select" name="employmentType" defaultValue=""><option value="">Any</option>{Object.values(EmploymentType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Rate<input className="field" name="rate" type="number" step="0.0001" /></label><label>Fixed<input className="field" name="fixedAmount" type="number" step="0.01" /></label><label>Cap<input className="field" name="capAmount" type="number" step="0.01" /></label><label>Start<input className="field" name="effectiveStartDate" type="date" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Plans</h3><span>{plans.length} configured</span></div><div className="grid" style={{ gap: 8 }}>{plans.map((plan) => <div className="mini-card" key={plan.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{plan.name}</strong><Badge tone={plan.activeStatus ? "green" : "neutral"}>{plan.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge></div><span>{plan.calculationType} / rate {plan.rate?.toString() ?? "n/a"} / fixed {plan.fixedAmount?.toString() ?? "n/a"} / cap {plan.capAmount?.toString() ?? "n/a"}</span></div>)}</div></section>
    </>
  );
}
