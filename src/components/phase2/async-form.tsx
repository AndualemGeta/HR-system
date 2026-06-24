"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

export function AsyncForm({
  action,
  children,
  className = "panel grid",
  method = "POST",
  submitLabel = "Save",
  successMessage = "Saved."
}: Readonly<{
  action: string;
  children?: ReactNode;
  className?: string;
  method?: "POST" | "PATCH";
  submitLabel?: string;
  successMessage?: string;
}>) {
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
    try {
      const response = await fetch(action, {
        method,
        body: new FormData(form)
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
      if (!response.ok) {
        setError(result.error ?? readableDetails(result.details) ?? "Request failed.");
        return;
      }
      form.reset();
      setMessage(successMessage);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={className} onSubmit={submit}>
      {children}
      {error && <p className="form-message error">{error}</p>}
      {message && <p className="form-message success">{message}</p>}
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function readableDetails(details: unknown) {
  if (typeof details === "string") return details;
  if (Array.isArray(details)) return details.map((detail) => String(detail)).join(", ");
  return null;
}
