import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ ruleId: string }> };
const patchSchema = z.object({
  activeStatus: z.coerce.boolean().optional(),
  description: z.string().optional().nullable(),
  approvalStatus: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "DEACTIVATED"]).optional(),
  changeReason: z.string().optional().nullable(),
  isSample: z.coerce.boolean().optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("payroll_rule.update");
  if (isApiError(principal)) return principal;
  const { ruleId } = await context.params;
  const parsed = patchSchema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll rule update.", details: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.payrollRule.findUnique({ where: { id: ruleId } });
  if (!existing) return NextResponse.json({ error: "Payroll rule not found." }, { status: 404 });
  if (parsed.data.approvalStatus === "APPROVED" && !parsed.data.changeReason && !existing.changeReason) {
    return NextResponse.json({ error: "Approving a payroll rule requires a change reason." }, { status: 422 });
  }
  const rule = await prisma.payrollRule.update({
    where: { id: ruleId },
    data: {
      ...parsed.data,
      approvedById: parsed.data.approvalStatus === "APPROVED" ? principal.id : undefined,
      reviewedById: parsed.data.approvalStatus ? principal.id : undefined,
      activeStatus: parsed.data.approvalStatus === "DEACTIVATED" ? false : parsed.data.activeStatus
    }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.activeStatus === false ? "PAYROLL_RULE_DEACTIVATION" : "PAYROLL_RULE_UPDATE",
    entityType: "PayrollRule",
    entityId: rule.id,
    oldValue: existing,
    newValue: rule
  });
  return NextResponse.json({ rule });
}
