import { NotificationCategory } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function NotificationPreferencesPage() {
  const principal = await requirePagePermission("notification_preferences.manage");
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: principal.id },
    orderBy: { category: "asc" }
  });
  const byCategory = new Map(preferences.map((preference) => [preference.category, preference]));

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Notification Preferences</h2>
          <p>Manage in-app, digest, and email preference flags for workflow and compliance notifications.</p>
        </div>
      </header>

      <div className="grid two">
        {Object.values(NotificationCategory).map((category) => {
          const preference = byCategory.get(category);
          return (
            <AsyncForm action="/api/notification-preferences" key={category}>
              <input name="category" type="hidden" value={category} />
              <div className="panel-header">
                <h3>{category}</h3>
                <Badge tone={preference?.inAppEnabled === false ? "neutral" : "green"}>{preference?.inAppEnabled === false ? "OFF" : "ON"}</Badge>
              </div>
              <div className="form-grid">
                <label>
                  In-app
                  <select className="select" name="inAppEnabled" defaultValue={String(preference?.inAppEnabled ?? true)}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <label>
                  Email
                  <select className="select" name="emailEnabled" defaultValue={String(preference?.emailEnabled ?? false)}>
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </label>
                <label>
                  Digest
                  <select className="select" name="digestEnabled" defaultValue={String(preference?.digestEnabled ?? false)}>
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </label>
              </div>
            </AsyncForm>
          );
        })}
      </div>
    </>
  );
}
