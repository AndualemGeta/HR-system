import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { canViewPayrollPreparation } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollPreparationDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const principal = await requirePagePermission("payroll_preparation.view");
  if (!canViewPayrollPreparation(principal)) redirect("/dashboard");
  const { batchId } = await params;
  const batch = await prisma.payrollPreparationBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: [{ readinessStatus: "asc" }, { employeeCode: "asc" }] } }
  });
  if (!batch) notFound();

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{batch.batchName}</h2>
          <p>
            {batch.payrollPeriodStart.toLocaleDateString()} - {batch.payrollPeriodEnd.toLocaleDateString()} / {batch.totalEmployees} employees
          </p>
        </div>
        <div className="toolbar">
          <Badge tone={batch.status === "APPROVED" || batch.status === "EXPORTED" ? "green" : batch.blockedCount > 0 ? "red" : "amber"}>{batch.status}</Badge>
          {hasPermission(principal, "payroll_preparation.export") && ["APPROVED", "EXPORTED"].includes(batch.status) && (
            <>
              <Link className="button secondary" href={`/api/payroll-preparation/${batch.id}/export`}>CSV</Link>
              <Link className="button secondary" href={`/api/payroll-preparation/${batch.id}/export?format=xlsx`}>XLSX</Link>
            </>
          )}
        </div>
      </header>

      <div className="grid stats">
        <div className="stat-card card"><span className="label">Ready</span><span className="value">{batch.readyCount}</span><span className="meta">Clean rows</span></div>
        <div className="stat-card card"><span className="label">Warnings</span><span className="value">{batch.warningCount}</span><span className="meta">Review before export</span></div>
        <div className="stat-card card"><span className="label">Blocked</span><span className="value">{batch.blockedCount}</span><span className="meta">Never exportable</span></div>
        <div className="stat-card card"><span className="label">Included</span><span className="value">{batch.rows.filter((row) => row.includedInExport && row.readinessStatus !== "BLOCKED").length}</span><span className="meta">Approved export rows</span></div>
      </div>

      {hasPermission(principal, "payroll_preparation.approve") && batch.status !== "APPROVED" && batch.status !== "EXPORTED" && (
        <AsyncForm action={`/api/payroll-preparation/${batch.id}`} method="PATCH" className="panel grid" >
          <input name="status" type="hidden" value="APPROVED" />
          <span>Approve payroll preparation for controlled export.</span>
        </AsyncForm>
      )}

      {hasPermission(principal, "payroll_calculation.run") && !["APPROVED", "EXPORTED"].includes(batch.status) && (
        <AsyncForm action="/api/payroll-calculation" className="panel grid" >
          <input name="batchId" type="hidden" value={batch.id} />
          <span>Run payroll calculation for attendance, commission, allowances, deductions, pension, and PAYE.</span>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Readiness Rows</h3>
          <span>{batch.rows.length} employees</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Location</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Commission</th>
                <th>Export</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {batch.rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.employeeCode}</strong><br />{row.fullName}</td>
                  <td>{row.role}<br />{row.level}</td>
                  <td>{[row.region, row.shop, row.cluster].filter(Boolean).join(" / ") || row.department || "Not set"}</td>
                  <td><Badge tone={row.readinessStatus === "READY" ? "green" : row.readinessStatus === "WARNING" ? "amber" : "red"}>{row.readinessStatus}</Badge></td>
                  <td>{row.grossSalary?.toString() ?? ""}</td>
                  <td>{row.netSalary?.toString() ?? ""}</td>
                  <td>{row.approvedCommission?.toString() ?? ""}</td>
                  <td>
                    {hasPermission(principal, "payroll_preparation.validate") && row.readinessStatus !== "BLOCKED" ? (
                      <AsyncForm action={`/api/payroll-preparation/${batch.id}`} method="PATCH" className="toolbar">
                        <input name="rowId" type="hidden" value={row.id} />
                        <input name="includedInExport" type="hidden" value={row.includedInExport ? "false" : "true"} />
                        <span>{row.includedInExport ? "Exclude" : "Include"}</span>
                      </AsyncForm>
                    ) : (
                      <Badge tone={row.includedInExport ? "green" : "neutral"}>{row.includedInExport ? "INCLUDED" : "EXCLUDED"}</Badge>
                    )}
                  </td>
                  <td><span>{Array.isArray(row.validationIssues) ? row.validationIssues.length : 0} issues</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
