"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ContractEmployee = {
  id: string;
  employeeId: string;
  fullName: string;
  hireDate: Date | null;
  currentRole: string;
  currentDepartment: { name: string } | null;
  documents: Array<{ id: string; uploadedAt: Date; notes: string | null }>;
  reminders: Array<{ id: string; dueDate: Date; status: string }>;
};

export function ContractRenewalsClient({
  employees,
  thresholdDate
}: {
  employees: ContractEmployee[];
  thresholdDate: Date;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const now = new Date();
  const soon = employees.filter((e) => {
    if (!e.hireDate) return false;
    const contractEnd = new Date(e.hireDate);
    contractEnd.setFullYear(contractEnd.getFullYear() + 1);
    return contractEnd <= thresholdDate && contractEnd >= now;
  });
  const expired = employees.filter((e) => {
    if (!e.hireDate) return false;
    const contractEnd = new Date(e.hireDate);
    contractEnd.setFullYear(contractEnd.getFullYear() + 1);
    return contractEnd < now;
  });

  async function createReminder(employeeId: string, employeeName: string) {
    setCreating((prev) => new Set(prev).add(employeeId));
    setMessage(null);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Contract renewal: ${employeeName}`,
          reminderType: "CONTRACT_EXPIRY",
          relatedEmployeeId: employeeId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        })
      });
      if (!response.ok) {
        const result = await response.json();
        setMessage(result.error ?? "Failed to create reminder.");
      } else {
        setMessage(`Reminder created for ${employeeName}.`);
        router.refresh();
      }
    } catch {
      setMessage("Failed to create reminder.");
    } finally {
      setCreating((prev) => { const next = new Set(prev); next.delete(employeeId); return next; });
    }
  }

  return (
    <div className="grid two">
      <section className="panel">
        <div className="panel-header">
          <h3>Expiring Soon (30 days)</h3>
          <span>{soon.length} contracts</span>
        </div>
        {soon.length === 0 && <p style={{ padding: 12, color: "#777" }}>No contracts expiring within 30 days.</p>}
        {soon.map((employee) => renderEmployeeCard(employee, creating, createReminder))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Expired Contracts</h3>
          <span>{expired.length} contracts</span>
        </div>
        {expired.length === 0 && <p style={{ padding: 12, color: "#777" }}>No expired contracts.</p>}
        {expired.map((employee) => renderEmployeeCard(employee, creating, createReminder))}
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel-header">
          <h3>All Contract Employees</h3>
          <span>{employees.length} total</span>
        </div>
        {employees.length === 0 && <p style={{ padding: 12, color: "#777" }}>No contract employees found.</p>}
        {employees.map((employee) => renderEmployeeCard(employee, creating, createReminder))}
      </section>

      {message && <p className="form-message success" style={{ gridColumn: "1 / -1" }}>{message}</p>}
    </div>
  );
}

function renderEmployeeCard(
  employee: ContractEmployee,
  creating: Set<string>,
  createReminder: (id: string, name: string) => void
) {
  const contractEnd = employee.hireDate ? new Date(employee.hireDate) : null;
  if (contractEnd) contractEnd.setFullYear(contractEnd.getFullYear() + 1);
  const isExpired = contractEnd && contractEnd < new Date();
  const hasReminder = employee.reminders.length > 0;

  return (
    <div className="mini-card" key={employee.id} style={isExpired ? { borderLeft: "4px solid #e53e3e" } : contractEnd && contractEnd <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? { borderLeft: "4px solid #d69e2e" } : {}}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong>{employee.fullName}</strong>
          <span style={{ display: "block", fontSize: 13, color: "#777" }}>
            {employee.currentRole} — {employee.currentDepartment?.name ?? "No dept"}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "#999" }}>
            Contract end: {contractEnd?.toLocaleDateString() ?? "N/A"}
            {isExpired && <span style={{ color: "#e53e3e", marginLeft: 8 }}>EXPIRED</span>}
          </span>
          <span style={{ fontSize: 12, color: "#999" }}>
            Documents: {employee.documents.length} | Reminders: {employee.reminders.length}
          </span>
        </div>
        {!hasReminder && (
          <button
            className="button secondary"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => createReminder(employee.id, employee.fullName)}
            disabled={creating.has(employee.id)}
          >
            {creating.has(employee.id) ? "..." : "Set Reminder"}
          </button>
        )}
      </div>
    </div>
  );
}
