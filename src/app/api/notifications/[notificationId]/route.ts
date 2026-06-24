import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const principal = await requirePermission("notification.view");
  if (isApiError(principal)) return principal;

  const { notificationId } = await context.params;
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  if (notification.recipientUserId !== principal.id && !hasPermission(principal, "notification.manage")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readStatus: true, readAt: new Date() }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "NOTIFICATION_READ",
    entityType: "Notification",
    entityId: updated.id,
    newValue: { readStatus: true }
  });

  return NextResponse.json({ notification: updated });
}
