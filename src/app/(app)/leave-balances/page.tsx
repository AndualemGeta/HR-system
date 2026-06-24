import { Badge } from "@/components/ui/badge";
import { canViewLeaveBalanceForEmployee } from "@/lib/phase5-access";
import { prisma } from "@/lib/prisma";
import { employeeScopeSelect, filterEmployeeIdLinkedRecords } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function LeaveBalancesPage() {
  const principal = await requirePagePermission("leave_balance.view");
  const [allBalances, employees] = await Promise.all([
    prisma.leaveBalance.findMany({ orderBy: [{ periodStart: "desc" }], take: 300 }),
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { employeeId: "asc" }, take: 500 })
  ]);
  const balances = filterEmployeeIdLinkedRecords(principal, allBalances, employees, canViewLeaveBalanceForEmployee);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Leave Balances</h2><p>Employee leave balance tracking for approved leave and adjustments.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Balances</h3><span>{balances.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{balances.map((balance) => <div className="mini-card" key={balance.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{balance.employeeId} / {balance.leaveType}</strong><Badge tone={balance.closingBalance.toNumber() < 0 ? "red" : "green"}>{balance.closingBalance.toString()}</Badge></div><span>{balance.periodStart.toLocaleDateString()} - {balance.periodEnd.toLocaleDateString()} / used {balance.usedDays.toString()}</span></div>)}</div></section>
    </>
  );
}
