import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollAttendancePage() {
  const principal = await requirePagePermission("payroll_attendance.view");
  const [inputs, employees] = await Promise.all([
    prisma.payrollAttendanceInput.findMany({ include: { employee: { select: { employeeId: true, fullName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.employee.findMany({ select: { id: true, employeeId: true, fullName: true }, orderBy: { employeeId: "asc" }, take: 300 })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Attendance</h2><p>Approved attendance inputs for salary proration and overtime.</p></div></header>
      {hasPermission(principal, "payroll_attendance.create") && <AsyncForm action="/api/payroll-attendance"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Start<input className="field" name="payrollPeriodStart" type="date" required /></label><label>End<input className="field" name="payrollPeriodEnd" type="date" required /></label><label>Working days<input className="field" name="workingDays" type="number" step="0.01" required /></label><label>Days present<input className="field" name="daysPresent" type="number" step="0.01" defaultValue="0" /></label><label>Paid leave<input className="field" name="paidLeaveDays" type="number" step="0.01" defaultValue="0" /></label><label>Unpaid leave<input className="field" name="unpaidLeaveDays" type="number" step="0.01" defaultValue="0" /></label><label>Sunday OT<input className="field" name="sundayOvertimeHours" type="number" step="0.01" defaultValue="0" /></label><label>Holiday OT<input className="field" name="holidayOvertimeHours" type="number" step="0.01" defaultValue="0" /></label><label>Night OT<input className="field" name="nightOvertimeHours" type="number" step="0.01" defaultValue="0" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Inputs</h3><span>{inputs.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{inputs.map((input) => <div className="mini-card" key={input.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{input.employee.employeeId} - {input.employee.fullName}</strong><Badge tone={input.approvalStatus === "APPROVED" ? "green" : input.approvalStatus === "REJECTED" ? "red" : "amber"}>{input.approvalStatus}</Badge></div><span>{input.payrollPeriodStart.toLocaleDateString()} - {input.payrollPeriodEnd.toLocaleDateString()} / working {input.workingDays.toString()} / present {input.daysPresent.toString()}</span>{hasPermission(principal, "payroll_attendance.approve") && input.approvalStatus !== "APPROVED" && <AsyncForm action={`/api/payroll-attendance/${input.id}`} method="PATCH" className="toolbar" submitLabel="Approve"><input name="approvalStatus" type="hidden" value="APPROVED" /></AsyncForm>}</div>)}</div></section>
    </>
  );
}
