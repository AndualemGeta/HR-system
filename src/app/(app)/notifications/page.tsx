import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function NotificationsPage() {
  const principal = await requirePagePermission("notification.view");
  const notifications = await prisma.notification.findMany({
    where: { recipientUserId: principal.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Notifications</h2>
          <p>Internal workflow notices for approvals, requests, status changes, and Phase 3 lifecycle events.</p>
        </div>
      </header>
      <section className="panel">
        <div className="panel-header">
          <h3>Inbox</h3>
          <span>{notifications.filter((notification) => !notification.readStatus).length} unread</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {notifications.map((notification) => (
            <div className="mini-card" key={notification.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{notification.title}</strong>
                <Badge tone={notification.readStatus ? "green" : "blue"}>{notification.readStatus ? "READ" : "UNREAD"}</Badge>
              </div>
              <span>{notification.message}</span>
              <span>{notification.createdAt.toLocaleString()}</span>
              {!notification.readStatus && (
                <AsyncForm action={`/api/notifications/${notification.id}`} method="PATCH" className="toolbar" submitLabel="Mark read" />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
