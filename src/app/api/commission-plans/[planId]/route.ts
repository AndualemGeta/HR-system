import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ planId: string }> };
const patchSchema = z.object({ activeStatus: z.coerce.boolean().optional(), description: z.string().optional().nullable() });

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("commission_plan.update");
  if (isApiError(principal)) return principal;
  const { planId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commission plan update.", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.commissionPlan.findUnique({ where: { id: planId } });
  if (!existing) return NextResponse.json({ error: "Commission plan not found." }, { status: 404 });
  const plan = await prisma.commissionPlan.update({ where: { id: planId }, data: parsed.data });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.activeStatus === false ? "COMMISSION_PLAN_DEACTIVATION" : "COMMISSION_PLAN_UPDATE",
    entityType: "CommissionPlan",
    entityId: plan.id,
    oldValue: existing,
    newValue: plan
  });
  return NextResponse.json({ plan });
}
