import { PayrollRuleType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { PAYROLL_RULE_SETUP_WARNING } from "@/lib/payroll-rule-governance";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayrollRulesPage() {
  const principal = await requirePagePermission("payroll_rule.view");
  const rules = await prisma.payrollRule.findMany({ orderBy: [{ activeStatus: "desc" }, { ruleType: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Payroll Rules</h2><p>Effective-dated payroll rule configuration for overtime, proration, allowances, deductions, and other setup values.</p></div></header>
      <section className="panel warning-panel"><strong>{PAYROLL_RULE_SETUP_WARNING}</strong></section>
      {hasPermission(principal, "payroll_rule.create") && <AsyncForm action="/api/payroll-rules"><div className="form-grid"><label>Type<select className="select" name="ruleType">{Object.values(PayrollRuleType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Name<input className="field" name="name" required /></label><label>Rate<input className="field" name="rate" type="number" step="0.0001" /></label><label>Amount<input className="field" name="amount" type="number" step="0.01" /></label><label>Start<input className="field" name="effectiveStartDate" type="date" required /></label><label>End<input className="field" name="effectiveEndDate" type="date" /></label><label>Approval<select className="select" name="approvalStatus" defaultValue="DRAFT"><option value="DRAFT">DRAFT</option><option value="SUBMITTED">SUBMITTED</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></label><label>Sample rule<select className="select" name="isSample" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label><label className="wide">Change reason<textarea className="textarea" name="changeReason" /></label><label className="wide">Description<textarea className="textarea" name="description" /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Rules</h3><span>{rules.length} configured</span></div><div className="grid" style={{ gap: 8 }}>{rules.map((rule) => <div className="mini-card" key={rule.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{rule.name}</strong><div className="toolbar"><Badge tone={rule.activeStatus ? "green" : "neutral"}>{rule.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge><Badge tone={rule.approvalStatus === "APPROVED" && !rule.isSample ? "green" : rule.approvalStatus === "REJECTED" ? "red" : "amber"}>{rule.isSample ? "SAMPLE" : rule.approvalStatus}</Badge></div></div><span>{rule.ruleType} / rate {rule.rate?.toString() ?? "n/a"} / amount {rule.amount?.toString() ?? "n/a"}</span></div>)}</div></section>
    </>
  );
}
