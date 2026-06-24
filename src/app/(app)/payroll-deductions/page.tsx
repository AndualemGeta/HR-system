import { DeductionType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollDeductionsPage() {
  const principal = await requirePagePermission("payroll_deduction.view");
  const [deductions, employees] = await Promise.all([
    prisma.payrollDeduction.findMany({ include: { employee: { select: { employeeId: true, fullName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.employee.findMany({ select: { id: true, employeeId: true, fullName: true }, orderBy: { employeeId: "asc" }, take: 300 })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Deductions</h2><p>Approved deductions included in payroll net salary.</p></div></header>
      {hasPermission(principal, "payroll_deduction.create") && <AsyncForm action="/api/payroll-deductions"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Start<input className="field" name="payrollPeriodStart" type="date" required /></label><label>End<input className="field" name="payrollPeriodEnd" type="date" required /></label><label>Type<select className="select" name="deductionType">{Object.values(DeductionType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Amount<input className="field" name="amount" type="number" step="0.01" required /></label><label>Pre-tax<select className="select" name="preTaxStatus" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label><label className="wide">Reason<textarea className="textarea" name="reason" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Deductions</h3><span>{deductions.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{deductions.map((deduction) => <div className="mini-card" key={deduction.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{deduction.employee.employeeId} - {deduction.deductionType}</strong><Badge tone={deduction.approvalStatus === "APPROVED" ? "green" : deduction.approvalStatus === "REJECTED" ? "red" : "amber"}>{deduction.approvalStatus}</Badge></div><span>{deduction.amount.toString()} / pre-tax {deduction.preTaxStatus ? "yes" : "no"}</span>{hasPermission(principal, "payroll_deduction.approve") && deduction.approvalStatus !== "APPROVED" && <AsyncForm action={`/api/payroll-deductions/${deduction.id}`} method="PATCH" className="toolbar" submitLabel="Approve"><input name="approvalStatus" type="hidden" value="APPROVED" /></AsyncForm>}</div>)}</div></section>
    </>
  );
}
