import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ImportPreviewPage() {
  await requirePagePermission("import.view");
  const batches = await prisma.importBatch.findMany({
    include: {
      rows: { orderBy: { rowNumber: "asc" }, take: 50 },
      validationIssues: { orderBy: { createdAt: "asc" }, take: 100 },
      fieldMappings: { orderBy: { sourceColumn: "asc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  const latest = batches[0];

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Import Validation Preview</h2>
          <p>Review normalized rows, field mappings, and validation issues before approval.</p>
        </div>
      </header>

      {!latest && (
        <section className="panel">
          <div className="panel-header">
            <h3>No Imports</h3>
            <span>Upload an HR file first</span>
          </div>
        </section>
      )}

      {latest && (
        <>
          <section className="panel">
            <div className="panel-header">
              <h3>{latest.fileName}</h3>
              <span>
                {latest.totalRows} rows / {latest.validationIssues.length} issues
              </span>
            </div>
            <div className="matrix">
              {latest.fieldMappings.map((mapping) => (
                <div className="mini-card" key={mapping.id}>
                  <span>{mapping.sourceColumn}</span>
                  <strong>{mapping.targetField}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <h3>Validation Issues</h3>
              <span>{latest.validationIssues.length} findings</span>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {latest.validationIssues.map((issue) => (
                <div className="mini-card" key={issue.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong>{issue.fieldName}</strong>
                    <Badge tone={issue.severity === "BLOCKER" ? "red" : issue.severity === "WARNING" ? "amber" : "blue"}>
                      {issue.severity}
                    </Badge>
                  </div>
                  <span>{issue.message}</span>
                  <span>{issue.suggestedFix ?? issue.issueCode}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <h3>Normalized Rows</h3>
              <span>{latest.rows.length} shown</span>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {latest.rows.map((row) => {
                const normalized = row.normalizedData as Record<string, unknown> | null;
                return (
                  <div className="mini-card" key={row.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>Row {row.rowNumber}</strong>
                      <Badge tone={row.status === "CLEAN" ? "green" : row.status === "BLOCKED" ? "red" : "amber"}>
                        {row.status}
                      </Badge>
                    </div>
                    <span>{String(normalized?.fullName ?? "Missing name")}</span>
                    <span>{String(normalized?.employeeId ?? "No ID")}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
