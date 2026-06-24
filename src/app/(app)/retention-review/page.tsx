import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function RetentionReviewPage() {
  await requirePagePermission("data_retention.view");
  const policies = await prisma.dataRetentionPolicy.findMany({ where: { activeStatus: true }, take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Retention Review</h2><p>Records due for review are surfaced here; no automatic deletion is performed.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Active policies</h3><span>{policies.length} policies</span></div><div className="grid" style={{ gap: 8 }}>{policies.map((policy) => <div className="mini-card" key={policy.id}><strong>{policy.entityType}</strong><span>{policy.actionAfterRetention} after {policy.retentionPeriodDays} days</span></div>)}</div></section>
    </>
  );
}
