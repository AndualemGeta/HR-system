import { PayrollLockStatus } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollPeriodLocksPage() {
  const principal = await requirePagePermission("payroll_lock.view");
  const locks = await prisma.payrollPeriodLock.findMany({ orderBy: { payrollPeriodStart: "desc" }, take: 100 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Period Locks</h2><p>Lock approved/exported periods and route corrections through payroll adjustments.</p></div></header>
      {hasPermission(principal, "payroll_lock.manage") && <AsyncForm action="/api/payroll-period-locks"><div className="form-grid"><label>Start<input className="field" name="payrollPeriodStart" type="date" required /></label><label>End<input className="field" name="payrollPeriodEnd" type="date" required /></label><label>Status<select className="select" name="lockStatus">{Object.values(PayrollLockStatus).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="wide">Reason<textarea className="textarea" name="reason" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Locks</h3><span>{locks.length} periods</span></div><div className="grid" style={{ gap: 8 }}>{locks.map((lock) => <div className="mini-card" key={lock.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{lock.payrollPeriodStart.toLocaleDateString()} - {lock.payrollPeriodEnd.toLocaleDateString()}</strong><Badge tone={lock.lockStatus === "LOCKED" ? "red" : lock.lockStatus === "UNLOCKED" ? "green" : "amber"}>{lock.lockStatus}</Badge></div><span>{lock.reason ?? "No reason recorded"}</span></div>)}</div></section>
    </>
  );
}
