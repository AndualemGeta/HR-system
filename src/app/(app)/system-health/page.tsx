import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SystemHealthPage() {
  await requirePagePermission("system_health.view");
  const [users, paye, pension, payrollRules] = await Promise.all([
    prisma.user.count(),
    prisma.payeTaxBracket.count({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false } }),
    prisma.pensionRule.count({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false } }),
    prisma.payrollRule.count({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false } })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>System Health</h2><p>Restricted operational health summary with safe details only.</p></div></header>
      <section className="grid three"><div className="stat-card"><span>Database</span><strong>Reachable</strong></div><div className="stat-card"><span>Users</span><strong>{users}</strong></div><div className="stat-card"><span>Email</span><strong>{process.env.EMAIL_DELIVERY_ENABLED === "true" ? "Enabled" : "Disabled"}</strong></div></section>
      <section className="panel" style={{ marginTop: 16 }}><div className="grid" style={{ gap: 8 }}><div className="mini-card"><strong>Approved PAYE brackets</strong><Badge tone={paye > 0 ? "green" : "red"}>{paye}</Badge></div><div className="mini-card"><strong>Approved pension rules</strong><Badge tone={pension > 0 ? "green" : "red"}>{pension}</Badge></div><div className="mini-card"><strong>Approved payroll rules</strong><Badge tone={payrollRules > 0 ? "green" : "red"}>{payrollRules}</Badge></div></div></section>
    </>
  );
}
