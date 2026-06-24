import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PayeTaxBracketsPage() {
  const principal = await requirePagePermission("paye_tax.view");
  const brackets = await prisma.payeTaxBracket.findMany({ orderBy: [{ activeStatus: "desc" }, { minIncome: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>PAYE Tax Brackets</h2><p>Effective-dated PAYE bracket setup. Values must be verified by Finance and HR before production payroll use.</p></div></header>
      {hasPermission(principal, "paye_tax.manage") && <AsyncForm action="/api/paye-tax-brackets"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Min income<input className="field" name="minIncome" type="number" step="0.01" required /></label><label>Max income<input className="field" name="maxIncome" type="number" step="0.01" /></label><label>Tax rate<input className="field" name="taxRate" type="number" step="0.0001" required /></label><label>Deduction<input className="field" name="deductionAmount" type="number" step="0.01" defaultValue="0" /></label><label>Start<input className="field" name="effectiveStartDate" type="date" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Brackets</h3><span>{brackets.length} configured</span></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Range</th><th>Rate</th><th>Deduction</th><th>Status</th></tr></thead><tbody>{brackets.map((bracket) => <tr key={bracket.id}><td>{bracket.name}</td><td>{bracket.minIncome.toString()} - {bracket.maxIncome?.toString() ?? "above"}</td><td>{bracket.taxRate.toString()}</td><td>{bracket.deductionAmount.toString()}</td><td><Badge tone={bracket.activeStatus ? "green" : "neutral"}>{bracket.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge></td></tr>)}</tbody></table></div></section>
    </>
  );
}
