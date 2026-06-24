import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await requirePermission("notification.view");
  if (isApiError(principal)) return principal;

  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1" && hasPermission(principal, "notification.manage");
  const notifications = await prisma.notification.findMany({
    where: all ? {} : { recipientUserId: principal.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ notifications });
}
