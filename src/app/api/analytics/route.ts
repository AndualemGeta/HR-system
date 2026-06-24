import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { getPhase4Analytics } from "@/lib/phase4-reports";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("analytics.view");
  if (isApiError(principal)) return principal;

  const analytics = await getPhase4Analytics(principal);
  await writeAuditLog({
    userId: principal.id,
    action: "ANALYTICS_VIEW",
    entityType: "Phase4Analytics",
    newValue: { headcount: analytics.headcount }
  });

  return NextResponse.json({ analytics });
}
