import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { redactMoney } from "@/lib/phase45-access";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function CommissionCalculationsPage() {
  const principal = await requirePagePermission("commission_calculation.view");
  const [calculations, employees, plans, evaluations] = await Promise.all([
    prisma.commissionCalculation.findMany({ include: { employee: { select: { employeeId: true, fullName: true } }, commissionPlan: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.employee.findMany({ select: { id: true, employeeId: true, fullName: true }, orderBy: { employeeId: "asc" }, take: 300 }),
    prisma.commissionPlan.findMany({ where: { activeStatus: true }, orderBy: { name: "asc" }, take: 100 }),
    prisma.employeeEvaluation.findMany({ where: { status: "APPROVED" }, include: { employee: { select: { employeeId: true } } }, orderBy: { updatedAt: "desc" }, take: 100 })
  ]);
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Commission Calculations</h2><p>Calculated commission is included in payroll only after approval.</p></div></header>
      {hasPermission(principal, "commission_calculation.create") && <AsyncForm action="/api/commission-calculations"><div className="form-grid"><label>Employee<select className="select" name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}</select></label><label>Plan<select className="select" name="commissionPlanId" defaultValue=""><option value="">Auto match</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label>Start<input className="field" name="periodStart" type="date" required /></label><label>End<input className="field" name="periodEnd" type="date" required /></label><label>Sales<input className="field" name="salesAmount" type="number" step="0.01" /></label><label>Target<input className="field" name="targetAmount" type="number" step="0.01" /></label><label>Manual adjustment<input className="field" name="manualAdjustment" type="number" step="0.01" defaultValue="0" /></label><label>Related evaluation<select className="select" name="relatedEvaluationId" defaultValue=""><option value="">None</option>{evaluations.map((evaluation) => <option key={evaluation.id} value={evaluation.id}>{evaluation.employee.employeeId} - {evaluation.compensationRecommendation}</option>)}</select></label><label className="wide">Adjustment reason<textarea className="textarea" name="manualAdjustmentReason" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Calculations</h3><span>{calculations.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{calculations.map((calculation) => <div className="mini-card" key={calculation.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{calculation.employee.employeeId} - {calculation.commissionPlan?.name ?? "No plan"}</strong><Badge tone={calculation.calculationStatus === "APPROVED" ? "green" : calculation.calculationStatus === "REJECTED" ? "red" : "amber"}>{calculation.calculationStatus}</Badge></div><span>Final {redactMoney(calculation.finalCommission, principal)} / achievement {calculation.achievementPercent?.toString() ?? "n/a"}</span>{hasPermission(principal, "commission_calculation.approve") && calculation.calculationStatus !== "APPROVED" && <AsyncForm action={`/api/commission-calculations/${calculation.id}`} method="PATCH" className="toolbar" submitLabel="Approve"><input name="calculationStatus" type="hidden" value="APPROVED" /></AsyncForm>}</div>)}</div></section>
    </>
  );
}
