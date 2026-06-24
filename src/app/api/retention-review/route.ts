import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("data_retention.view");
  if (isApiError(principal)) return principal;
  const policies = await prisma.dataRetentionPolicy.findMany({ where: { activeStatus: true }, take: 200 });
  const now = new Date();
  const due = policies.map((policy) => ({
    policyId: policy.id,
    entityType: policy.entityType,
    actionAfterRetention: policy.actionAfterRetention,
    reviewBefore: new Date(now.getTime() - policy.retentionPeriodDays * 86_400_000)
  }));
  return NextResponse.json({ due, note: "Core HR records are review-only by default; no automatic deletion is performed." });
}
