import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function IntegrationTokensPage() {
  const principal = await requirePagePermission("integration_token.view");
  const tokens = await prisma.integrationToken.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Integration Tokens</h2><p>Token hashes are stored, raw tokens are shown only once, and external endpoints stay restricted.</p></div><Badge tone="amber">Foundation only</Badge></header>
      {hasPermission(principal, "integration_token.manage") && <AsyncForm action="/api/integration-tokens"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Scopes CSV<input className="field" name="allowedScopes" placeholder="attendance.read,payroll.export" required /></label><label>Expires<input className="field" name="expiresAt" type="date" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Tokens</h3><span>{tokens.length} configured</span></div><div className="grid" style={{ gap: 8 }}>{tokens.map((token) => <div className="mini-card" key={token.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{token.name}</strong><Badge tone={token.activeStatus ? "green" : "neutral"}>{token.activeStatus ? "ACTIVE" : "REVOKED"}</Badge></div><span>Expires {token.expiresAt?.toLocaleDateString() ?? "not set"} / hash stored</span></div>)}</div></section>
    </>
  );
}
