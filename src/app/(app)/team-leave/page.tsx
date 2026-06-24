import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function TeamLeavePage() {
  const principal = await requirePagePermission("team_leave.view");
  const balances = await prisma.leaveBalance.findMany({ where: { employeeId: { in: principal.directReportIds ?? [] } }, orderBy: { periodStart: "desc" }, take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Team Leave</h2><p>Scope-limited leave balance overview for managers.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Balances</h3><span>{balances.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{balances.map((balance) => <div className="mini-card" key={balance.id}><strong>{balance.employeeId} / {balance.leaveType}</strong><span>Closing {balance.closingBalance.toString()} / used {balance.usedDays.toString()}</span></div>)}</div></section>
    </>
  );
}
