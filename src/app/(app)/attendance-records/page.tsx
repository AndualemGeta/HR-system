import { AttendanceStatus } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function AttendanceRecordsPage() {
  const principal = await requirePagePermission("attendance.view");
  const [records, employees] = await Promise.all([
    prisma.attendanceRecord.findMany({ orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }], take: 300 }),
    prisma.employee.findMany({ orderBy: { employeeId: "asc" }, take: 500 })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Attendance Records</h2><p>Manual attendance foundation for HR/payroll until future biometric integrations are approved.</p></div></header>
      {hasPermission(principal, "attendance.create") && <AsyncForm action="/api/attendance-records"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Date<input className="field" name="attendanceDate" type="date" required /></label><label>Status<select className="select" name="status">{Object.values(AttendanceStatus).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Hours<input className="field" name="hoursWorked" type="number" step="0.01" /></label><label>Overtime<input className="field" name="overtimeHours" type="number" step="0.01" /></label><label className="wide">Notes<textarea className="textarea" name="notes" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Records</h3><span>{records.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{records.map((record) => <div className="mini-card" key={record.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{record.employeeId} / {record.attendanceDate.toLocaleDateString()}</strong><Badge tone={record.approvalStatus === "APPROVED" ? "green" : record.approvalStatus === "REJECTED" ? "red" : "amber"}>{record.approvalStatus}</Badge></div><span>{record.status} / hours {record.hoursWorked?.toString() ?? "n/a"} / overtime {record.overtimeHours?.toString() ?? "0"}</span></div>)}</div></section>
    </>
  );
}
