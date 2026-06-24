import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("security_reports.view");
  if (isApiError(principal)) return principal;
  const [failedLogins, inactiveUsersWithAccess, salaryUsers, exportUsers, adminUsers, recentExports, recentAudit] = await Promise.all([
    prisma.auditLog.count({ where: { action: "FAILED_LOGIN" } }),
    prisma.user.count({ where: { status: { not: "ACTIVE" }, roles: { some: {} } } }),
    prisma.user.count({ where: { roles: { some: { role: { permissions: { some: { permission: { key: "salary.view" } } } } } } } }),
    prisma.user.count({ where: { roles: { some: { role: { permissions: { some: { permission: { key: { in: ["export.create", "payroll_preparation.export"] } } } } } } } } }),
    prisma.user.count({ where: { roles: { some: { role: { name: { in: ["SUPER_ADMIN", "HR_ADMIN"] } } } } } }),
    prisma.exportHistory.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 20 })
  ]);
  return NextResponse.json({
    failedLogins,
    inactiveUsersWithAccess,
    usersWithSalaryPermission: salaryUsers,
    usersWithExportPermission: exportUsers,
    usersWithAdminPermission: adminUsers,
    recentExports,
    recentAudit
  });
}
