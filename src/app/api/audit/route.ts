import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("audit.view");
  if (isApiError(principal)) return principal;

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { timestamp: "desc" },
    take: 200
  });

  return NextResponse.json({ logs });
}

