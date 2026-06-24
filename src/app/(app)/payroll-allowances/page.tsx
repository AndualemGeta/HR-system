import { AllowanceType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollAllowancesPage() {
  const principal = await requirePagePermission("payroll_allowance.view");
  const [allowances, employees] = await Promise.all([
    prisma.payrollAllowance.findMany({ include: { employee: { select: { employeeId: true, fullName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.employee.findMany({ select: { id: true, employeeId: true, fullName: true }, orderBy: { employeeId: "asc" }, take: 300 })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Allowances</h2><p>Approved allowances included in payroll gross salary.</p></div></header>
      {hasPermission(principal, "payroll_allowance.create") && <AsyncForm action="/api/payroll-allowances"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Start<input className="field" name="payrollPeriodStart" type="date" required /></label><label>End<input className="field" name="payrollPeriodEnd" type="date" required /></label><label>Type<select className="select" name="allowanceType">{Object.values(AllowanceType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Amount<input className="field" name="amount" type="number" step="0.01" required /></label><label>Taxable<select className="select" name="taxableStatus" defaultValue="true"><option value="true">Yes</option><option value="false">No</option></select></label><label className="wide">Reason<textarea className="textarea" name="reason" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Allowances</h3><span>{allowances.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{allowances.map((allowance) => <div className="mini-card" key={allowance.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{allowance.employee.employeeId} - {allowance.allowanceType}</strong><Badge tone={allowance.approvalStatus === "APPROVED" ? "green" : allowance.approvalStatus === "REJECTED" ? "red" : "amber"}>{allowance.approvalStatus}</Badge></div><span>{allowance.amount.toString()} / taxable {allowance.taxableStatus ? "yes" : "no"}</span>{hasPermission(principal, "payroll_allowance.approve") && allowance.approvalStatus !== "APPROVED" && <AsyncForm action={`/api/payroll-allowances/${allowance.id}`} method="PATCH" className="toolbar" submitLabel="Approve"><input name="approvalStatus" type="hidden" value="APPROVED" /></AsyncForm>}</div>)}</div></section>
    </>
  );
}
