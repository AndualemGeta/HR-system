import { LeaveType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canViewScopedEmployee, employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function LeavePage() {
  const principal = await requirePagePermission("leave.view");
  const [leaveRecords, allEmployees] = await Promise.all([
    prisma.leaveRecord.findMany({
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            currentRole: true,
            currentDepartmentId: true,
            currentRegionId: true,
            currentShopId: true,
            currentClusterId: true,
            directManagerId: true
          }
        }
      },
      orderBy: { startDate: "desc" },
      take: 100
    }),
    prisma.employee.findMany({
      select: employeeScopeSelect,
      orderBy: { fullName: "asc" },
      take: 200
    })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, canViewScopedEmployee);

  const visibleLeaveRecords = leaveRecords.filter((record) =>
    canViewScopedEmployee(principal, employeeToScope(record.employee))
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Leave Records</h2>
          <p>Simple Phase 2 leave tracking with scoped visibility and approval status.</p>
        </div>
      </header>

      {hasPermission(principal, "leave.create") && (
        <AsyncForm action="/api/leave">
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
              Leave type
              <select className="select" name="leaveType" defaultValue="ANNUAL_LEAVE">
                {Object.values(LeaveType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start date
              <input className="field" name="startDate" type="date" required />
            </label>
            <label>
              End date
              <input className="field" name="endDate" type="date" required />
            </label>
            <label className="wide">
              Reason
              <textarea className="textarea" name="reason" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Leave Records</h3>
          <span>{visibleLeaveRecords.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleLeaveRecords.map((record) => (
            <div className="mini-card" key={record.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>
                  {record.employee.employeeId} - {record.employee.fullName}
                </strong>
                <Badge tone={record.approvalStatus === "APPROVED" ? "green" : "amber"}>
                  {record.approvalStatus}
                </Badge>
              </div>
              <span>
                {record.leaveType} - {record.startDate.toLocaleDateString()} to {record.endDate.toLocaleDateString()}
              </span>
              <span>{record.totalDays ? `${record.totalDays.toString()} days` : "Days not calculated"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
