import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ManagerDashboardPage() {
  const principal = await requirePagePermission("manager_dashboard.view");
  const team = await prisma.employee.findMany({ where: { id: { in: principal.directReportIds ?? [] } }, orderBy: { fullName: "asc" }, take: 300 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Manager Self-Service</h2><p>Team actions are limited to reporting scope and granted permissions.</p></div></header>
      <section className="grid three"><div className="stat-card"><span>Team employees</span><strong>{team.length}</strong></div><div className="stat-card"><span>Active</span><strong>{team.filter((employee) => employee.employmentStatus === "ACTIVE").length}</strong></div><div className="stat-card"><span>Scope</span><strong>Direct reports</strong></div></section>
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Team</h3><Link href="/team-attendance">Attendance</Link></div><div className="grid" style={{ gap: 8 }}>{team.map((employee) => <div className="mini-card" key={employee.id}><strong>{employee.employeeId} - {employee.fullName}</strong><span>{employee.currentRole} / {employee.employmentStatus}</span></div>)}</div></section>
    </>
  );
}
