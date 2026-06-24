import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function EmailDeliveryLogsPage() {
  await requirePagePermission("email_log.view");
  const logs = await prisma.emailDeliveryLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Email Delivery Logs</h2><p>Delivery attempts are logged; development delivery is skipped unless explicitly enabled.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Logs</h3><span>{logs.length} attempts</span></div><div className="grid" style={{ gap: 8 }}>{logs.map((log) => <div className="mini-card" key={log.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{log.recipientEmail}</strong><Badge tone={log.status === "SENT" ? "green" : log.status === "FAILED" ? "red" : "amber"}>{log.status}</Badge></div><span>{log.subject}</span></div>)}</div></section>
    </>
  );
}
