import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function IntegrationEventLogsPage() {
  await requirePagePermission("integration_event.view");
  const events = await prisma.integrationEventLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Integration Event Logs</h2><p>Safe event/webhook foundation. No outbound webhooks are sent unless explicitly configured later.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Events</h3><span>{events.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{events.map((event) => <div className="mini-card" key={event.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{event.eventType}</strong><Badge tone={event.status === "PROCESSED" ? "green" : event.status === "FAILED" ? "red" : "amber"}>{event.status}</Badge></div><span>{event.entityType ?? "No entity"} / {event.createdAt.toLocaleString()}</span></div>)}</div></section>
    </>
  );
}
