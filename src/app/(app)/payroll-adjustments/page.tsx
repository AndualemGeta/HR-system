import { PayrollAdjustmentType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewPayrollInput } from "@/lib/phase45-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterEmployeeIdLinkedRecords, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollAdjustmentsPage() {
  const principal = await requirePagePermission("payroll_adjustment.view");
  const [allAdjustments, allEmployees] = await Promise.all([
    prisma.payrollAdjustment.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { employeeId: "asc" }, take: 500 })
  ]);
  const adjustments = filterEmployeeIdLinkedRecords(principal, allAdjustments, allEmployees, canViewPayrollInput);
  const employees = filterVisibleEmployees(principal, allEmployees, canViewPayrollInput);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Adjustments</h2><p>Record corrections for future payroll without silently overwriting locked periods.</p></div></header>
      {hasPermission(principal, "payroll_adjustment.create") && <AsyncForm action="/api/payroll-adjustments"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Start<input className="field" name="payrollPeriodStart" type="date" required /></label><label>End<input className="field" name="payrollPeriodEnd" type="date" required /></label><label>Type<select className="select" name="adjustmentType">{Object.values(PayrollAdjustmentType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Amount<input className="field" name="amount" type="number" step="0.01" required /></label><label className="wide">Reason<textarea className="textarea" name="reason" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Adjustments</h3><span>{adjustments.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{adjustments.map((adjustment) => <div className="mini-card" key={adjustment.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{adjustment.adjustmentType}</strong><Badge tone={adjustment.approvalStatus === "APPROVED" ? "green" : adjustment.approvalStatus === "REJECTED" ? "red" : "amber"}>{adjustment.approvalStatus}</Badge></div><span>{adjustment.amount.toString()} / {adjustment.reason}</span></div>)}</div></section>
    </>
  );
}
