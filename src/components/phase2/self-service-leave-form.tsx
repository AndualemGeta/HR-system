"use client";

import { LeaveType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function SelfServiceLeaveForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const form = event.currentTarget;
    const data = {
      leaveType: (form.elements.namedItem("leaveType") as HTMLSelectElement).value,
      startDate: (form.elements.namedItem("startDate") as HTMLInputElement).value,
      endDate: (form.elements.namedItem("endDate") as HTMLInputElement).value,
      reason: (form.elements.namedItem("reason") as HTMLTextAreaElement).value || null
    };

    try {
      const response = await fetch("/api/self-service/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Request failed.");
        return;
      }
      form.reset();
      setMessage("Leave request submitted for approval.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Leave Type
          <select className="select" name="leaveType" required>
            {Object.values(LeaveType).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Start Date
          <input className="field" type="date" name="startDate" required />
        </label>
        <label>
          End Date
          <input className="field" type="date" name="endDate" required />
        </label>
        <label className="wide">
          Reason
          <textarea className="textarea" name="reason" />
        </label>
      </div>
      {error && <p className="form-message error">{error}</p>}
      {message && <p className="form-message success">{message}</p>}
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Leave Request"}
      </button>
    </form>
  );
}
