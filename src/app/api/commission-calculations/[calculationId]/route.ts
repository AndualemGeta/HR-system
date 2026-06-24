import { CommissionCalculationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ calculationId: string }> };
const patchSchema = z.object({ calculationStatus: z.nativeEnum(CommissionCalculationStatus) });

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("commission_calculation.approve");
  if (isApiError(principal)) return principal;
  const { calculationId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commission status update.", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.commissionCalculation.findUnique({ where: { id: calculationId } });
  if (!existing) return NextResponse.json({ error: "Commission calculation not found." }, { status: 404 });
  const calculation = await prisma.commissionCalculation.update({
    where: { id: existing.id },
    data: {
      calculationStatus: parsed.data.calculationStatus,
      reviewedById: ["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(parsed.data.calculationStatus) ? principal.id : existing.reviewedById,
      approvedById: parsed.data.calculationStatus === "APPROVED" ? principal.id : existing.approvedById
    }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.calculationStatus === "APPROVED" ? "COMMISSION_CALCULATION_APPROVAL" : "COMMISSION_CALCULATION_REJECTION",
    entityType: "CommissionCalculation",
    entityId: calculation.id,
    oldValue: { status: existing.calculationStatus },
    newValue: { status: calculation.calculationStatus }
  });
  return NextResponse.json({ calculation });
}
