import Link from "next/link";
import { LogOut } from "lucide-react";
import { TerminationType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function TerminationPage() {
  const principal = await requirePagePermission("termination.view");
  const [allEmployees, terminations] = await Promise.all([
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { fullName: "asc" }, take: 200 }),
    prisma.terminationCase.findMany({ include: { employee: true, exitItems: true }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, (user, employee) =>
    canCreateLifecycleRecord(user, employee, "termination.create")
  );
  const visibleTerminations = terminations.filter((termination) =>
    canViewLifecycleRecord(principal, employeeToScope(termination.employee), "termination.view")
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Termination & Exit</h2>
          <p>Manage resignation, termination approval, final payment status, clearance, and exit completion.</p>
        </div>
        <Link className="button secondary" href="/api/exports/terminations">
          Export CSV
        </Link>
      </header>

      {hasPermission(principal, "termination.create") && (
        <AsyncForm action="/api/termination">
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
              Type
              <select className="select" name="terminationType" defaultValue="RESIGNATION">
                {Object.values(TerminationType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
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
            <label>
              Notice date
              <input className="field" name="noticeDate" type="date" />
            </label>
            <label>
              Last working date
              <input className="field" name="lastWorkingDate" type="date" />
            </label>
            <label className="wide">
              Reason
              <textarea className="textarea" name="reason" required />
            </label>
          </div>
          <span className="button secondary" style={{ width: "fit-content" }}>
            <LogOut size={16} aria-hidden="true" />
            Prepare exit
          </span>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Exit Cases</h3>
          <span>{visibleTerminations.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleTerminations.map((termination) => (
            <Link className="mini-card" href={`/termination/${termination.id}`} key={termination.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{termination.employee.fullName}</strong>
                <Badge tone={termination.status === "EXIT_COMPLETED" ? "green" : termination.status === "REJECTED" ? "red" : "amber"}>
                  {termination.status}
                </Badge>
              </div>
              <span>
                {termination.terminationType} / clearance {termination.clearanceStatus} / payment {termination.finalPaymentStatus}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
