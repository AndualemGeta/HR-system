import { PayrollLockStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canManagePayrollLock } from "@/lib/phase5-access";
import { validateUnlockRequest } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  payrollPeriodStart: z.string().min(1),
  payrollPeriodEnd: z.string().min(1),
  lockStatus: z.nativeEnum(PayrollLockStatus).default("LOCKED"),
  reason: z.string().min(1)
});

export async function GET() {
  const principal = await requirePermission("payroll_lock.view");
  if (isApiError(principal)) return principal;
  const locks = await prisma.payrollPeriodLock.findMany({ orderBy: { payrollPeriodStart: "desc" }, take: 100 });
  return NextResponse.json({ locks });
}

export async function POST(request: Request) {
  const principal = await requirePermission("payroll_lock.manage");
  if (isApiError(principal)) return principal;
  if (!canManagePayrollLock(principal)) return NextResponse.json({ error: "Permission denied for payroll lock management." }, { status: 403 });
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll lock.", details: parsed.error.flatten() }, { status: 400 });
  if (["UNLOCK_REQUESTED", "TEMPORARILY_UNLOCKED", "UNLOCKED"].includes(parsed.data.lockStatus)) {
    const issues = validateUnlockRequest(parsed.data);
    if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  }
  const start = new Date(parsed.data.payrollPeriodStart);
  const end = new Date(parsed.data.payrollPeriodEnd);
  const lock = await prisma.payrollPeriodLock.upsert({
    where: { payrollPeriodStart_payrollPeriodEnd: { payrollPeriodStart: start, payrollPeriodEnd: end } },
    update: {
      lockStatus: parsed.data.lockStatus,
      reason: parsed.data.reason,
      lockedById: parsed.data.lockStatus === "LOCKED" ? principal.id : undefined,
      lockedAt: parsed.data.lockStatus === "LOCKED" ? new Date() : undefined,
      unlockRequestedById: parsed.data.lockStatus === "UNLOCK_REQUESTED" ? principal.id : undefined,
      unlockedById: ["UNLOCKED", "TEMPORARILY_UNLOCKED"].includes(parsed.data.lockStatus) ? principal.id : undefined,
      unlockedAt: ["UNLOCKED", "TEMPORARILY_UNLOCKED"].includes(parsed.data.lockStatus) ? new Date() : undefined
    },
    create: {
      payrollPeriodStart: start,
      payrollPeriodEnd: end,
      lockStatus: parsed.data.lockStatus,
      reason: parsed.data.reason,
      lockedById: parsed.data.lockStatus === "LOCKED" ? principal.id : null,
      lockedAt: parsed.data.lockStatus === "LOCKED" ? new Date() : null
    }
  });
  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.lockStatus === "LOCKED" ? "PAYROLL_PERIOD_LOCK" : parsed.data.lockStatus === "UNLOCK_REQUESTED" ? "PAYROLL_PERIOD_UNLOCK_REQUEST" : "PAYROLL_PERIOD_UNLOCK",
    entityType: "PayrollPeriodLock",
    entityId: lock.id,
    newValue: lock
  });
  return NextResponse.json({ lock }, { status: 201 });
}
