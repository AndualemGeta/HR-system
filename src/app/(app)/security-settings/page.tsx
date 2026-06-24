import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SecuritySettingsPage() {
  await requirePagePermission("security_settings.view");
  return (
    <>
      <header className="page-header"><div className="page-title"><h2>Security Settings</h2><p>Password policy and session controls are environment-driven for Phase 5.</p></div></header>
      <section className="panel"><div className="grid three"><div className="mini-card"><strong>Password minimum</strong><span>{process.env.PASSWORD_MIN_LENGTH ?? "10"} characters</span></div><div className="mini-card"><strong>Session timeout</strong><span>8 hours</span></div><div className="mini-card"><strong>2FA</strong><Badge tone="amber">Not enabled for this review</Badge><span>Placeholder only, disabled</span></div></div></section>
    </>
  );
}
