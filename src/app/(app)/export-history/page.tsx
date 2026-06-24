import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ExportHistoryPage() {
  await requirePagePermission("export_history.view");
  const history = await prisma.exportHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Export History</h2>
          <p>Auditable history of Phase 4 exports, including payroll preparation files and report downloads.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h3>Exports</h3>
          <span>{history.length} entries</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Format</th>
                <th>Rows</th>
                <th>File</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.exportType}</strong></td>
                  <td><Badge tone={entry.format === "xlsx" ? "green" : "blue"}>{entry.format}</Badge></td>
                  <td>{entry.rowCount}</td>
                  <td>{entry.fileName ?? "Generated response"}</td>
                  <td>{entry.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
