import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

const defaults = [
  ["environment_variables", "Environment variables confirmed"],
  ["database_migrations", "Database migration procedure confirmed"],
  ["admin_user", "Admin user creation confirmed"],
  ["backup_restore", "Backup and restore procedure confirmed"],
  ["payroll_rules", "Payroll rules confirmed by HR/Finance"],
  ["role_review", "User role review complete"],
  ["deployment_steps", "Deployment steps documented"],
  ["rollback_plan", "Rollback plan documented"]
];

export default async function ProductionReadinessPage() {
  await requirePagePermission("production_readiness.view");
  for (const [key, label] of defaults) {
    await prisma.productionReadinessCheck.upsert({ where: { key }, update: {}, create: { key, label } });
  }
  const checks = await prisma.productionReadinessCheck.findMany({ orderBy: { key: "asc" } });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Production Readiness</h2><p>Deployment checklist for environment, migration, backup, security, audit, and payroll governance.</p></div></header>
      <section className="panel"><div className="grid" style={{ gap: 8 }}>{checks.map((check) => <div className="mini-card" key={check.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{check.label}</strong><Badge tone={check.completed ? "green" : "amber"}>{check.completed ? "DONE" : "OPEN"}</Badge></div><AsyncForm action="/api/production-readiness" className="toolbar" submitLabel={check.completed ? "Reopen" : "Complete"}><input type="hidden" name="key" value={check.key} /><input type="hidden" name="completed" value={check.completed ? "false" : "true"} /></AsyncForm></div>)}</div></section>
    </>
  );
}
