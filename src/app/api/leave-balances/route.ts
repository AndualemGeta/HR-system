import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { employeeToScope } from "@/lib/phase4-access";
import { canViewLeaveBalanceForEmployee } from "@/lib/phase5-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("leave_balance.view");
  if (isApiError(principal)) return principal;
  const balances = await prisma.leaveBalance.findMany({ orderBy: [{ periodStart: "desc" }], take: 500 });
  const employees = await prisma.employee.findMany({ where: { id: { in: balances.map((balance) => balance.employeeId) } } });
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  return NextResponse.json({
    balances: balances.filter((balance) => {
      const employee = employeeMap.get(balance.employeeId);
      return employee ? canViewLeaveBalanceForEmployee(principal, employeeToScope(employee)) : false;
    })
  });
}
