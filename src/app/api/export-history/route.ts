import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("export_history.view");
  if (isApiError(principal)) return principal;

  const history = await prisma.exportHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ history });
}
