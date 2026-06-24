import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("system_health.view");
  if (isApiError(principal)) return principal;
  const [userCount, payeCount, pensionCount, approvedPayrollRuleCount] = await Promise.all([
    prisma.user.count(),
    prisma.payeTaxBracket.count({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false } }),
    prisma.pensionRule.count({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false } }),
    prisma.payrollRule.count({ where: { activeStatus: true, approvalStatus: "APPROVED", isSample: false } })
  ]);
  await writeAuditLog({ userId: principal.id, action: "SYSTEM_HEALTH_VIEW", entityType: "SystemHealth", newValue: { safe: true } });
  return NextResponse.json({
    database: "reachable",
    migrations: "use prisma migrate status for exact drift checks",
    fileStorage: "local-development",
    emailConfiguration: process.env.EMAIL_DELIVERY_ENABLED === "true" ? "enabled" : "disabled",
    backgroundJobs: "not-configured",
    userCount,
    activeApprovedPayeBrackets: payeCount,
    activeApprovedPensionRules: pensionCount,
    activeApprovedPayrollRules: approvedPayrollRuleCount
  });
}
