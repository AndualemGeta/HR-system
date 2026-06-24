import { DataRetentionEntityType, RetentionAction } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function DataRetentionPoliciesPage() {
  const principal = await requirePagePermission("data_retention.view");
  const policies = await prisma.dataRetentionPolicy.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Data Retention Policies</h2><p>Core HR records default to review or keep-forever governance, not automatic deletion.</p></div></header>
      {hasPermission(principal, "data_retention.manage") && <AsyncForm action="/api/data-retention-policies"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Entity<select className="select" name="entityType">{Object.values(DataRetentionEntityType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Days<input className="field" name="retentionPeriodDays" type="number" required /></label><label>Action<select className="select" name="actionAfterRetention">{Object.values(RetentionAction).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Policies</h3><span>{policies.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{policies.map((policy) => <div className="mini-card" key={policy.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{policy.name}</strong><Badge tone={policy.activeStatus ? "green" : "neutral"}>{policy.actionAfterRetention}</Badge></div><span>{policy.entityType} / {policy.retentionPeriodDays} days</span></div>)}</div></section>
    </>
  );
}
