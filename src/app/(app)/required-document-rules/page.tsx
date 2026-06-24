import { DocumentType, EmployeeRole, EmploymentType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function RequiredDocumentRulesPage() {
  const principal = await requirePagePermission("required_document_rule.view");
  const rules = await prisma.requiredDocumentRule.findMany({
    orderBy: [{ activeStatus: "desc" }, { documentType: "asc" }, { name: "asc" }],
    take: 300
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Required Document Rules</h2>
          <p>Configure which employee documents are required by employment type, role, department, or division.</p>
        </div>
      </header>

      {hasPermission(principal, "required_document_rule.manage") && (
        <AsyncForm action="/api/required-document-rules">
          <div className="form-grid">
            <label>Name<input className="field" name="name" required /></label>
            <label>Document<select className="select" name="documentType">{Object.values(DocumentType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>Employment type<select className="select" name="applicableEmploymentType" defaultValue="FULL_TIME"><option value="">Any</option>{Object.values(EmploymentType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>Role<select className="select" name="applicableRole" defaultValue=""><option value="">Any</option>{Object.values(EmployeeRole).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><h3>Rules</h3><span>{rules.length} configured</span></div>
        <div className="grid list-grid">
          {rules.map((rule) => (
            <div className="mini-card compact-card" key={rule.id}>
              <div className="row-between">
                <strong>{rule.name}</strong>
                <Badge tone={rule.activeStatus ? "green" : "neutral"}>{rule.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
              <span>{rule.documentType} / {rule.applicableEmploymentType ?? "Any type"} / {rule.applicableRole ?? "Any role"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
