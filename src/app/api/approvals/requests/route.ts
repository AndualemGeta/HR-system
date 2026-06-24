import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("approval.view");
  if (isApiError(principal)) return principal;

  const requests = await prisma.approvalRequest.findMany({
    include: {
      workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
      actions: { orderBy: { actionDate: "desc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return NextResponse.json({ requests });
}
