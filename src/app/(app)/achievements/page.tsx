import { AchievementType } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canCreateAchievementFor, canViewScopedEmployee, employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function AchievementsPage() {
  const principal = await requirePagePermission("achievement.view");
  const [achievements, allEmployees] = await Promise.all([
    prisma.achievement.findMany({
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
        },
        department: true,
        region: true,
        shop: true
      },
      orderBy: { achievementDate: "desc" },
      take: 100
    }),
    prisma.employee.findMany({
      select: employeeScopeSelect,
      orderBy: { fullName: "asc" },
      take: 200
    })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, canCreateAchievementFor);

  const visibleAchievements = achievements.filter((achievement) =>
    achievement.approvalStatus === "APPROVED"
      ? canViewScopedEmployee(principal, employeeToScope(achievement.employee))
      : canCreateAchievementFor(principal, employeeToScope(achievement.employee))
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Achievements</h2>
          <p>Recognition records by employee, department, shop, approval status, and achievement type.</p>
        </div>
      </header>

      {hasPermission(principal, "achievement.create") && (
        <AsyncForm action="/api/achievements">
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
              Achievement type
              <select className="select" name="achievementType" defaultValue="TOP_PERFORMER">
                {Object.values(AchievementType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input className="field" name="title" required />
            </label>
            <label>
              Date
              <input className="field" name="achievementDate" type="date" required />
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
          <h3>Recognition History</h3>
          <span>{visibleAchievements.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleAchievements.map((achievement) => (
            <div className="mini-card" key={achievement.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{achievement.title}</strong>
                <Badge tone={achievement.approvalStatus === "APPROVED" ? "green" : "amber"}>
                  {achievement.approvalStatus}
                </Badge>
              </div>
              <span>
                {achievement.employee.employeeId} - {achievement.employee.fullName}
              </span>
              <span>
                {achievement.achievementType} - {achievement.achievementDate.toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
