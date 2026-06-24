import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("email_log.view");
  if (isApiError(principal)) return principal;
  const logs = await prisma.emailDeliveryLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ logs, emailEnabled: process.env.EMAIL_DELIVERY_ENABLED === "true" });
}
