import { ReminderType, ReminderStatus } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { employeeToScope } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { canViewEmployee, hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function RemindersPage() {
  const principal = await requirePagePermission("reminder.view");
  const [allReminders, allEmployees, users] = await Promise.all([
    prisma.hRReminder.findMany({
      include: { relatedEmployee: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 200
    }),
    prisma.employee.findMany({ orderBy: { employeeId: "asc" }, take: 300 }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 100 })
  ]);
  const reminders = allReminders.filter(
    (reminder) =>
      reminder.assignedToId === principal.id ||
      !reminder.relatedEmployee ||
      canViewEmployee(principal, employeeToScope(reminder.relatedEmployee))
  );
  const employees = allEmployees.filter((employee) => canViewEmployee(principal, employeeToScope(employee)));

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>HR Reminders</h2>
          <p>Track probation, evaluation, document, disciplinary, exit, payroll, and KPI follow-up dates.</p>
        </div>
      </header>

      {hasPermission(principal, "reminder.create") && (
        <AsyncForm action="/api/reminders">
          <div className="form-grid">
            <label>
              Title
              <input className="field" name="title" required />
            </label>
            <label>
              Type
              <select className="select" name="reminderType">{Object.values(ReminderType).map((type) => <option key={type} value={type}>{type}</option>)}</select>
            </label>
            <label>
              Due date
              <input className="field" name="dueDate" type="date" required />
            </label>
            <label>
              Employee
              <select className="select" name="relatedEmployeeId" defaultValue="">
                <option value="">None</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.fullName}</option>)}
              </select>
            </label>
            <label>
              Assign to
              <select className="select" name="assignedToId" defaultValue="">
                <option value="">Unassigned</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label className="wide">
              Description
              <textarea className="textarea" name="description" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Reminder Queue</h3>
          <span>{reminders.length} reminders</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {reminders.map((reminder) => (
            <div className="mini-card" key={reminder.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{reminder.title}</strong>
                <Badge tone={reminder.status === "COMPLETED" ? "green" : reminder.status === "OVERDUE" ? "red" : "amber"}>{reminder.status}</Badge>
              </div>
              <span>{reminder.reminderType} / due {reminder.dueDate.toLocaleDateString()}</span>
              <span>{reminder.relatedEmployee ? `${reminder.relatedEmployee.employeeId} - ${reminder.relatedEmployee.fullName}` : "No employee link"}</span>
              {hasPermission(principal, "reminder.complete") && !["COMPLETED", "CANCELLED"].includes(reminder.status) && (
                <div className="toolbar">
                  {(["COMPLETED", "CANCELLED"] as ReminderStatus[]).map((status) => (
                    <AsyncForm action={`/api/reminders/${reminder.id}`} method="PATCH" className="toolbar" key={status}>
                      <input name="status" type="hidden" value={status} />
                      <span>{status}</span>
                    </AsyncForm>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
