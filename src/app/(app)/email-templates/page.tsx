import { NotificationType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function EmailTemplatesPage() {
  const principal = await requirePagePermission("email_template.view");
  const templates = await prisma.emailTemplate.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Email Templates</h2><p>Email is disabled unless `EMAIL_DELIVERY_ENABLED=true`; templates must not expose restricted fields.</p></div></header>
      {hasPermission(principal, "email_template.manage") && <AsyncForm action="/api/email-templates"><div className="form-grid"><label>Name<input className="field" name="name" required /></label><label>Type<select className="select" name="notificationType">{Object.values(NotificationType).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="wide">Subject<input className="field" name="subjectTemplate" required /></label><label className="wide">Body<textarea className="textarea" name="bodyTemplate" required /></label></div></AsyncForm>}
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Templates</h3><span>{templates.length} rows</span></div><div className="grid" style={{ gap: 8 }}>{templates.map((template) => <div className="mini-card" key={template.id}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{template.name}</strong><Badge tone={template.activeStatus ? "green" : "neutral"}>{template.notificationType}</Badge></div><span>{template.subjectTemplate}</span></div>)}</div></section>
    </>
  );
}
