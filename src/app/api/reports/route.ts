import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { getDashboardMetrics } from "@/lib/reports";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("reports.view");
  if (isApiError(principal)) return principal;

  return NextResponse.json(await getDashboardMetrics(principal));
}
