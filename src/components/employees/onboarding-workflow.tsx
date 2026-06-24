"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, RotateCcw, Save } from "lucide-react";
import { employmentStatuses, employmentTypes } from "@/lib/constants";

type ChecklistItem = {
  key: string;
  label: string;
  completed: boolean;
};

type EmployeeProfileForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  employmentType: string;
  employmentStatus: string;
  statusReason: string;
};

type ValidationPayload = {
  validation?: {
    blockers?: Array<{ field: string; message: string }>;
    warnings?: Array<{ field: string; message: string }>;
    reviewItems?: Array<{ field: string; message: string }>;
  };
  error?: string;
  details?: string;
};

export function OnboardingWorkflow({
  employeeId,
  initialProfile,
  initialItems
}: Readonly<{
  employeeId: string;
  initialProfile: EmployeeProfileForm;
  initialItems: ChecklistItem[];
}>) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [items, setItems] = useState(initialItems);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [checklistMessage, setChecklistMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const completedCount = useMemo(() => items.filter((item) => item.completed).length, [items]);

  async function saveChecklist() {
    setSavingChecklist(true);
    setChecklistError(null);
    setChecklistMessage(null);

    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ key, completed }) => ({ key, completed }))
        })
      });
      const result = (await response.json()) as ValidationPayload;

      if (!response.ok) {
        setChecklistError(formatApiMessage(result, "Unable to save onboarding checklist."));
        return;
      }

      setChecklistMessage("Onboarding checklist saved.");
      router.refresh();
    } catch (error) {
      setChecklistError(error instanceof Error ? error.message : "Unable to save onboarding checklist.");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(employeeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          middleName: profile.middleName || null,
          email: profile.email || null,
          phoneNumber: profile.phoneNumber || null,
          address: profile.address || null,
          employmentType: profile.employmentType || null,
          statusReason: profile.statusReason || "Onboarding profile update"
        })
      });
      const result = (await response.json()) as ValidationPayload;

      if (!response.ok) {
        setProfileError(formatApiMessage(result, "Unable to update employee profile."));
        return;
      }

      setProfileMessage("Employee profile and status saved.");
      router.refresh();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to update employee profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header">
        <div>
          <h3>Onboarding Workflow</h3>
          <span>
            {completedCount} of {items.length} checklist items complete
          </span>
        </div>
      </div>

      <div className="grid two">
        <div>
          <div className="panel-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <h3>Checklist</h3>
            <div className="toolbar">
              <button
                className="button secondary"
                type="button"
                onClick={() => setItems((current) => current.map((item) => ({ ...item, completed: true })))}
              >
                <CheckCheck size={16} aria-hidden="true" />
                Complete all
              </button>
              <button className="button secondary" type="button" onClick={() => setItems(initialItems)}>
                <RotateCcw size={16} aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>

          <div className="grid" style={{ gap: 8 }}>
            {items.map((item) => (
              <label className="mini-card" key={item.key} style={{ alignItems: "center", flexDirection: "row" }}>
                <input
                  checked={item.completed}
                  type="checkbox"
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.key === item.key ? { ...entry, completed: event.target.checked } : entry
                      )
                    )
                  }
                />
                <strong style={{ fontSize: 14 }}>{item.label}</strong>
              </label>
            ))}
          </div>

          {checklistError && <p style={{ color: "#b42318", marginTop: 12 }}>{checklistError}</p>}
          {checklistMessage && <p style={{ color: "#166f55", marginTop: 12 }}>{checklistMessage}</p>}

          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="button" type="button" disabled={savingChecklist} onClick={saveChecklist}>
              <Save size={16} aria-hidden="true" />
              {savingChecklist ? "Saving..." : "Save checklist"}
            </button>
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <div className="form-grid">
            <label>
              First name
              <input
                className="field"
                required
                value={profile.firstName}
                onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
              />
            </label>
            <label>
              Middle name
              <input
                className="field"
                value={profile.middleName}
                onChange={(event) => setProfile({ ...profile, middleName: event.target.value })}
              />
            </label>
            <label>
              Last name
              <input
                className="field"
                required
                value={profile.lastName}
                onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
              />
            </label>
            <label>
              Email
              <input
                className="field"
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              />
            </label>
            <label>
              Phone number
              <input
                className="field"
                value={profile.phoneNumber}
                onChange={(event) => setProfile({ ...profile, phoneNumber: event.target.value })}
              />
            </label>
            <label>
              Employment type
              <select
                className="select"
                value={profile.employmentType}
                onChange={(event) => setProfile({ ...profile, employmentType: event.target.value })}
              >
                <option value="">To be confirmed</option>
                {employmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Employment status
              <select
                className="select"
                value={profile.employmentStatus}
                onChange={(event) => setProfile({ ...profile, employmentStatus: event.target.value })}
              >
                {employmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status reason
              <input
                className="field"
                value={profile.statusReason}
                onChange={(event) => setProfile({ ...profile, statusReason: event.target.value })}
              />
            </label>
            <label className="wide">
              Address
              <textarea
                className="textarea"
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
              />
            </label>
          </div>

          {profileError && <p style={{ color: "#b42318", marginTop: 12 }}>{profileError}</p>}
          {profileMessage && <p style={{ color: "#166f55", marginTop: 12 }}>{profileMessage}</p>}

          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="button" type="submit" disabled={savingProfile}>
              <Save size={16} aria-hidden="true" />
              {savingProfile ? "Saving..." : "Save profile and status"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function formatApiMessage(payload: ValidationPayload, fallback: string): string {
  const validation = payload.validation;
  const issues = [
    ...(validation?.blockers ?? []),
    ...(validation?.warnings ?? []),
    ...(validation?.reviewItems ?? [])
  ];

  if (issues.length > 0) {
    return issues.map((issue) => issue.message).join(" ");
  }

  return payload.details || payload.error || fallback;
}
