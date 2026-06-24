import Link from "next/link";
import { EmployeeLevel, EmployeeRole } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function TransfersPage() {
  const principal = await requirePagePermission("transfer.view");
  const [allEmployees, transfers, departments, locations] = await Promise.all([
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { fullName: "asc" }, take: 200 }),
    prisma.transferRequest.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, (user, employee) =>
    canCreateLifecycleRecord(user, employee, "transfer.create")
  );
  const visibleTransfers = transfers.filter((transfer) =>
    canViewLifecycleRecord(principal, employeeToScope(transfer.employee), "transfer.view")
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Transfer Requests</h2>
          <p>Request, approve, and complete assignment transfers without changing active assignments before approval.</p>
        </div>
        <Link className="button secondary" href="/api/exports/transfers">
          Export CSV
        </Link>
      </header>

      {hasPermission(principal, "transfer.create") && (
        <AsyncForm action="/api/transfers">
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
              Department
              <select className="select" name="requestedDepartmentId" defaultValue="">
                <option value="">No change</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select className="select" name="requestedShopId" defaultValue="">
                <option value="">No shop change</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.type})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Role
              <select className="select" name="requestedRole" defaultValue="">
                <option value="">No role change</option>
                {Object.values(EmployeeRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Level
              <select className="select" name="requestedLevel" defaultValue="">
                <option value="">No level change</option>
                {Object.values(EmployeeLevel).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effective date
              <input className="field" name="effectiveDate" type="date" />
            </label>
            <label className="wide">
              Reason
              <textarea className="textarea" name="reason" required />
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
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Requests</h3>
          <span>{visibleTransfers.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleTransfers.map((transfer) => (
            <Link className="mini-card" href={`/transfers/${transfer.id}`} key={transfer.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{transfer.employee.fullName}</strong>
                <Badge tone={transfer.status === "COMPLETED" ? "green" : transfer.status === "REJECTED" ? "red" : "amber"}>
                  {transfer.status}
                </Badge>
              </div>
              <span>{transfer.requestedRole ?? "Assignment transfer"} / {transfer.effectiveDate?.toLocaleDateString() ?? "No effective date"}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
