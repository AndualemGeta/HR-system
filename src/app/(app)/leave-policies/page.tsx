import { EmploymentType, LeaveAccrualMethod, LeaveType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function LeavePoliciesPage() {
  const principal = await requirePagePermission("leave_policy.view");
  const policies = await prisma.leavePolicy.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Leave Policies</h2><p>Effective-dated leave entitlement and accrual setup.</p></div><Badge tone="amber">Requires HR/Finance configuration</Badge></header>
      {hasPermission(principal, "leave_policy.manage") && <AsyncForm action="/api/leave-policies"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Leave type<select className="select" name="leaveType">{Object.values(LeaveType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Employment type<select className="select" name="employmentType" defaultValue=""><option value="">Any</option>{Object.values(EmploymentType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Entitlement<input className="field" name="annualEntitlementDays" type="number" step="0.01" required /></label><label>Accrual<select className="select" name="accrualMethod">{Object.values(LeaveAccrualMethod).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Start<input className="field" name="effectiveStartDate" type="date" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Policies</h3><span>{policies.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{policies.map((policy) => <div className="mini-card" key={policy.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{policy.name}</strong><Badge tone={policy.activeStatus ? "green" : "neutral"}>{policy.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge></div><span>{policy.leaveType} / {policy.annualEntitlementDays.toString()} days / {policy.accrualMethod}</span></div>)}</div></section>
    </>
  );
}
