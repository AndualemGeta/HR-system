import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ApiDocumentationPage() {
  await requirePagePermission("production_readiness.view");
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>API Documentation</h2><p>Internal API map for authenticated, permission-controlled operations.</p></div></header>
      <section className="panel"><div className="grid" style={{ gap: 8 }}>
        {["/api/employees", "/api/payroll-preparation/[batchId]/export", "/api/attendance-import", "/api/kpi/results", "/api/approvals/requests", "/api/notifications", "/api/integration-tokens", "/api/system-health"].map((endpoint) => <div className="mini-card" key={endpoint}><strong>{endpoint}</strong><span>Requires session authentication and permission checks; integration tokens do not bypass RBAC.</span></div>)}
      </div></section>
    </>
  );
}
