import { LeaveType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewLeaveBalanceForEmployee } from "@/lib/phase5-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterEmployeeIdLinkedRecords, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function LeaveBalanceAdjustmentsPage() {
  const principal = await requirePagePermission("leave_balance.view");
  const [allAdjustments, allEmployees] = await Promise.all([
    prisma.leaveBalanceAdjustment.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { employeeId: "asc" }, take: 500 })
  ]);
  const adjustments = filterEmployeeIdLinkedRecords(principal, allAdjustments, allEmployees, canViewLeaveBalanceForEmployee);
  const employees = filterVisibleEmployees(principal, allEmployees, canViewLeaveBalanceForEmployee);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Leave Balance Adjustments</h2><p>Approved corrections to employee leave balances.</p></div></header>
      {hasPermission(principal, "leave_balance.adjust") && <AsyncForm action="/api/leave-balance-adjustments"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Leave type<select className="select" name="leaveType">{Object.values(LeaveType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Days<input className="field" name="adjustmentDays" type="number" step="0.01" required /></label><label className="wide">Reason<textarea className="textarea" name="reason" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Adjustments</h3><span>{adjustments.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{adjustments.map((adjustment) => <div className="mini-card" key={adjustment.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{adjustment.employeeId} / {adjustment.leaveType}</strong><Badge tone={adjustment.approvalStatus === "APPROVED" ? "green" : "amber"}>{adjustment.approvalStatus}</Badge></div><span>{adjustment.adjustmentDays.toString()} days / {adjustment.reason}</span></div>)}</div></section>
    </>
  );
}
