import { canViewAttendanceForEmployee } from "@/lib/phase5-access";
import { prisma } from "@/lib/prisma";
import { employeeScopeSelect, filterEmployeeIdLinkedRecords } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function TeamAttendancePage() {
  const principal = await requirePagePermission("team_attendance.view");
  const [allRecords, employees] = await Promise.all([
    prisma.attendanceRecord.findMany({ orderBy: { attendanceDate: "desc" }, take: 200 }),
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { employeeId: "asc" }, take: 500 })
  ]);
  const records = filterEmployeeIdLinkedRecords(principal, allRecords, employees, canViewAttendanceForEmployee);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Team Attendance</h2><p>Scope-limited attendance overview for managers.</p></div></header>
      <section className="panel"><div className="panel-header"><h3>Records</h3><span>{records.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{records.map((record) => <div className="mini-card" key={record.id}><strong>{record.employeeId} / {record.attendanceDate.toLocaleDateString()}</strong><span>{record.status} / {record.approvalStatus}</span></div>)}</div></section>
    </>
  );
}
