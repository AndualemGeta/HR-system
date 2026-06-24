import { SystemSettingValueType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SystemSettingsPage() {
  const principal = await requirePagePermission("system_settings.view");
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" }, take: 200 });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>System Settings</h2>
          <p>Administrative configuration values with sensitive values redacted unless the user can update settings.</p>
        </div>
      </header>

      {hasPermission(principal, "system_settings.update") && (
        <AsyncForm action="/api/system-settings">
          <div className="form-grid">
            <label>
              Key
              <input className="field" name="key" required />
            </label>
            <label>
              Type
              <select className="select" name="valueType">{Object.values(SystemSettingValueType).map((type) => <option key={type} value={type}>{type}</option>)}</select>
            </label>
            <label>
              Sensitive
              <select className="select" name="isSensitive" defaultValue="false">
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
            <label className="wide">
              Value
              <textarea className="textarea" name="value" required />
            </label>
            <label className="wide">
              Description
              <textarea className="textarea" name="description" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Settings</h3>
          <span>{settings.length} keys</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Type</th>
                <th>Sensitive</th>
                <th>Value</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.id}>
                  <td><strong>{setting.key}</strong><br />{setting.description ?? ""}</td>
                  <td>{setting.valueType}</td>
                  <td><Badge tone={setting.isSensitive ? "amber" : "green"}>{setting.isSensitive ? "SENSITIVE" : "NORMAL"}</Badge></td>
                  <td>{setting.isSensitive && !hasPermission(principal, "system_settings.update") ? "REDACTED" : setting.value}</td>
                  <td>{setting.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
