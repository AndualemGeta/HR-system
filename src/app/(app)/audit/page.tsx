import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function AuditPage() {
  await requirePagePermission("audit.view");
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { timestamp: "desc" },
    take: 100
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Audit Logs</h2>
          <p>Immutable trail for login, employee, salary, status, assignment, onboarding, and permission events.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h3>Recent Events</h3>
          <span>{logs.length} records</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {logs.map((log) => (
            <div className="mini-card" key={log.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{log.action}</strong>
                <Badge tone={log.action.includes("SALARY") ? "amber" : "blue"}>{log.entityType}</Badge>
              </div>
              <span>{log.user?.email ?? "System"} - {log.timestamp.toLocaleString()}</span>
              <span>{log.entityId ?? "No entity ID"}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="mini-card">
              <strong>No audit logs yet</strong>
              <span>Login and HR actions will appear here as users work in the system.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
