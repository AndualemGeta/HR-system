import { Upload } from "lucide-react";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { importTargetFields, requiredImportTargetFields } from "@/lib/import/validator";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ImportsPage() {
  const principal = await requirePagePermission("import.view");
  const imports = await prisma.importBatch.findMany({
    include: {
      validationIssues: { take: 5, orderBy: { createdAt: "asc" } },
      fieldMappings: { orderBy: { sourceColumn: "asc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>HR File Import</h2>
          <p>Upload CSV/XLS/XLSX files, detect columns, validate rows, and approve valid records.</p>
        </div>
      </header>

      {hasPermission(principal, "import.validate") && (
        <AsyncForm action="/api/imports">
          <div className="form-grid">
            <label className="wide">
              HR file
              <input className="field" name="file" type="file" accept=".csv,.xls,.xlsx" required />
            </label>
          </div>
          <span className="button secondary" style={{ width: "fit-content" }}>
            <Upload size={16} aria-hidden="true" />
            CSV, XLS, XLSX
          </span>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Import History</h3>
          <span>{imports.length} batches</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {imports.map((batch) => (
            <div className="mini-card" key={batch.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{batch.fileName}</strong>
                <Badge tone={batch.status === "APPROVED" ? "green" : batch.blockedRows > 0 ? "red" : "amber"}>
                  {batch.status}
                </Badge>
              </div>
              <span>
                Total {batch.totalRows} / clean {batch.cleanRows} / warnings {batch.warningRows} / review {batch.reviewRows} /
                blocked {batch.blockedRows}
              </span>
              <span>{batch.createdAt.toLocaleString()}</span>
              {hasPermission(principal, "import.validate") && batch.status !== "APPROVED" && (
                <AsyncForm action={`/api/imports/${batch.id}/mapping`} className="grid" >
                  <div className="form-grid">
                    {batch.fieldMappings.map((mapping) => (
                      <label key={mapping.id}>
                        {mapping.sourceColumn}
                        <select className="select" name={`mapping_${mapping.id}`} defaultValue={mapping.targetField}>
                          <option value="unmapped">Unmapped</option>
                          {importTargetFields.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <span>
                    Required: {requiredImportTargetFields.map((field) => field.label).join(", ")}
                  </span>
                </AsyncForm>
              )}
              {hasPermission(principal, "import.approve") && batch.status !== "APPROVED" && batch.validRows > 0 && (
                <AsyncForm action={`/api/imports/${batch.id}/approve`} className="toolbar" submitLabel="Approve valid rows" />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
