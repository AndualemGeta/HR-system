import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { disciplinaryIncidentTypes, warningLevels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function DisciplinaryPage() {
  const principal = await requirePagePermission("disciplinary.view");
  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ orderBy: { fullName: "asc" }, take: 200 }),
    prisma.disciplinaryRecord.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  const visibleRecords = records.filter((record) =>
    canViewLifecycleRecord(principal, employeeToScope(record.employee), "disciplinary.view")
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Disciplinary Records</h2>
          <p>Track incidents, warnings, review status, follow-ups, and approval history with scoped access.</p>
        </div>
        <Link className="button secondary" href="/api/exports/disciplinary">
          Export CSV
        </Link>
      </header>

      {hasPermission(principal, "disciplinary.create") && (
        <AsyncForm action="/api/disciplinary">
          <div className="form-grid">
            <label>
              Employee
              <select className="select" name="employeeId" required>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeId} - {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Incident type
              <select className="select" name="incidentType" required>
                {disciplinaryIncidentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Incident date
              <input className="field" name="incidentDate" type="date" required />
            </label>
            <label>
              Warning level
              <select className="select" name="warningLevel" defaultValue="">
                <option value="">None</option>
                {warningLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Follow-up date
              <input className="field" name="followUpDate" type="date" />
            </label>
            <label>
              Status
              <select className="select" name="status" defaultValue="DRAFT">
                {["DRAFT", "SUBMITTED"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Description
              <textarea className="textarea" name="description" required />
            </label>
            <label className="wide">
              Action taken
              <textarea className="textarea" name="actionTaken" />
            </label>
          </div>
          <span className="button secondary" style={{ width: "fit-content" }}>
            <ShieldAlert size={16} aria-hidden="true" />
            Draft or submit
          </span>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Records</h3>
          <span>{visibleRecords.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleRecords.map((record) => (
            <Link className="mini-card" href={`/disciplinary/${record.id}`} key={record.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{record.employee.fullName}</strong>
                <Badge tone={record.status === "APPROVED" ? "green" : record.status === "REJECTED" ? "red" : "amber"}>
                  {record.status}
                </Badge>
              </div>
              <span>
                {record.incidentType} / {record.incidentDate.toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
