import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SecurityReportsPage() {
  await requirePagePermission("security_reports.view");
  const [failedLogins, exportCount, auditCount] = await Promise.all([
    prisma.auditLog.count({ where: { action: "FAILED_LOGIN" } }),
    prisma.exportHistory.count(),
    prisma.auditLog.count()
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Security Reports</h2><p>Permission, login, export, and audit activity summaries.</p></div></header>
      <section className="grid three"><div className="stat-card"><span>Failed logins</span><strong>{failedLogins}</strong></div><div className="stat-card"><span>Exports</span><strong>{exportCount}</strong></div><div className="stat-card"><span>Audit events</span><strong>{auditCount}</strong></div></section>
    </>
  );
}
