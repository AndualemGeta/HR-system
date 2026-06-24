import Link from "next/link";
import { redirect } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewPayrollPreparation } from "@/lib/phase4-access";
import { PAYROLL_RULE_SETUP_WARNING } from "@/lib/payroll-rule-governance";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollPreparationPage() {
  const principal = await requirePagePermission("payroll_preparation.view");
  if (!canViewPayrollPreparation(principal)) redirect("/dashboard");
  const batches = await prisma.payrollPreparationBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Payroll Preparation</h2>
          <p>Validate payroll readiness, exclude blocked rows, approve controlled batches, and export only after approval.</p>
        </div>
      </header>

      <section className="panel warning-panel"><strong>{PAYROLL_RULE_SETUP_WARNING}</strong></section>

      {hasPermission(principal, "payroll_preparation.create") && (
        <AsyncForm action="/api/payroll-preparation">
          <div className="form-grid">
            <label>
              Batch name
              <input className="field" name="batchName" placeholder="June 2026 payroll prep" />
            </label>
            <label>
              Period start
              <input className="field" name="payrollPeriodStart" type="date" required />
            </label>
            <label>
              Period end
              <input className="field" name="payrollPeriodEnd" type="date" required />
            </label>
            <label className="wide">
              Notes
              <textarea className="textarea" name="notes" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Batches</h3>
          <span>{batches.length} prepared</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Period</th>
                <th>Status</th>
                <th>Ready</th>
                <th>Warning</th>
                <th>Blocked</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <Link href={`/payroll-preparation/${batch.id}`}>
                      <strong>{batch.batchName}</strong>
                    </Link>
                  </td>
                  <td>
                    {batch.payrollPeriodStart.toLocaleDateString()} - {batch.payrollPeriodEnd.toLocaleDateString()}
                  </td>
                  <td><Badge tone={batch.status === "APPROVED" || batch.status === "EXPORTED" ? "green" : batch.blockedCount > 0 ? "red" : "amber"}>{batch.status}</Badge></td>
                  <td>{batch.readyCount}</td>
                  <td>{batch.warningCount}</td>
                  <td>{batch.blockedCount}</td>
                  <td>{batch.totalEmployees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
