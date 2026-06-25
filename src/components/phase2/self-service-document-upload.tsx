"use client";

import { DocumentType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function SelfServiceDocumentUpload() {
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
      const response = await fetch("/api/self-service/documents", {
        method: "POST",
        body: new FormData(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Upload failed.");
        return;
      }
      form.reset();
      setMessage("Document uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid" onSubmit={submit} encType="multipart/form-data">
      <div className="form-grid">
        <label>
          Document Type
          <select className="select" name="documentType" required>
            {Object.values(DocumentType).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          File
          <input className="field" type="file" name="file" required />
        </label>
        <label className="wide">
          Notes
          <textarea className="textarea" name="notes" />
        </label>
      </div>
      {error && <p className="form-message error">{error}</p>}
      {message && <p className="form-message success">{message}</p>}
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Uploading..." : "Upload Document"}
      </button>
    </form>
  );
}
