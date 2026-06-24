import Link from "next/link";
import { EmployeeLevel, EmployeeRole } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canCreateLifecycleRecord, canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { canUpdateSalary, hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PromotionsPage() {
  const principal = await requirePagePermission("promotion.view");
  const [allEmployees, promotions] = await Promise.all([
    prisma.employee.findMany({ select: employeeScopeSelect, orderBy: { fullName: "asc" }, take: 200 }),
    prisma.promotionRequest.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, (user, employee) =>
    canCreateLifecycleRecord(user, employee, "promotion.create")
  );
  const visiblePromotions = promotions.filter((promotion) =>
    canViewLifecycleRecord(principal, employeeToScope(promotion.employee), "promotion.view")
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Promotion Requests</h2>
          <p>Prepare, approve, and complete role, level, and permitted salary changes.</p>
        </div>
        <Link className="button secondary" href="/api/exports/promotions">
          Export CSV
        </Link>
      </header>

      {hasPermission(principal, "promotion.create") && (
        <AsyncForm action="/api/promotions">
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
              Proposed role
              <select className="select" name="proposedRole" defaultValue="">
                <option value="">No role change</option>
                {Object.values(EmployeeRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proposed level
              <select className="select" name="proposedLevel" defaultValue="">
                <option value="">No level change</option>
                {Object.values(EmployeeLevel).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            {canUpdateSalary(principal) && (
              <>
                <label>
                  Proposed salary
                  <input className="field" name="proposedSalary" type="number" step="0.01" />
                </label>
                <label>
                  Salary effective
                  <input className="field" name="salaryEffectiveDate" type="date" />
                </label>
              </>
            )}
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
          <span>{visiblePromotions.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visiblePromotions.map((promotion) => (
            <Link className="mini-card" href={`/promotions/${promotion.id}`} key={promotion.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{promotion.employee.fullName}</strong>
                <Badge tone={promotion.status === "COMPLETED" ? "green" : promotion.status === "REJECTED" ? "red" : "amber"}>
                  {promotion.status}
                </Badge>
              </div>
              <span>
                {promotion.proposedRole ?? promotion.currentRole} / salary{" "}
                {canUpdateSalary(principal) ? promotion.proposedSalary?.toString() ?? "none" : "restricted"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
