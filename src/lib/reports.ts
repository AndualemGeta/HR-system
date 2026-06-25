import type { EmployeeRoleValue } from "@/lib/constants";
import { canViewEmployee, hasAnySystemRole, hasPermission, type Principal } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function getDashboardMetrics(principal?: Principal) {
  const now = new Date();
  const [employees, documents, leaveRecords, achievements, evaluations, importHistorySummary, importValidationIssues] =
    await Promise.all([
      prisma.employee.findMany({
        include: {
          documents: { where: { isActive: true }, select: { documentType: true } },
          evaluationsReceived: {
            select: {
              id: true,
              evaluationPeriodStart: true,
              evaluationPeriodEnd: true,
              status: true,
              rating: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.employeeDocument.findMany({
        where: { isActive: true },
        include: { employee: true },
        take: 1000
      }),
      prisma.leaveRecord.findMany({
        include: { employee: true },
        take: 1000
      }),
      prisma.achievement.findMany({
        include: { employee: true },
        take: 1000
      }),
      prisma.employeeEvaluation.findMany({
        include: { employee: true },
        take: 1000
      }),
      canSeeCompanyReports(principal) && (!principal || hasPermission(principal, "import.view"))
        ? prisma.importBatch.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              fileName: true,
              status: true,
              totalRows: true,
              validRows: true,
              warningRows: true,
              reviewRows: true,
              blockedRows: true,
              approvedAt: true,
              createdAt: true
            }
          })
        : Promise.resolve([]),
      canSeeCompanyReports(principal) && (!principal || hasPermission(principal, "import.view"))
        ? prisma.importValidationIssue.groupBy({ by: ["severity"], _count: { _all: true } })
        : Promise.resolve([])
    ]);

  const scopedEmployees = principal
    ? employees.filter((employee) => canViewEmployee(principal, employeeToReportScope(employee)))
    : employees;
  const scopedEmployeeIds = new Set(scopedEmployees.map((employee) => employee.id));
  const scopedDocuments = documents.filter((document) => scopedEmployeeIds.has(document.employeeId));
  const scopedLeaveRecords = leaveRecords.filter((record) => scopedEmployeeIds.has(record.employeeId));
  const scopedAchievements = achievements.filter((achievement) => scopedEmployeeIds.has(achievement.employeeId));
  const scopedEvaluations = evaluations.filter((evaluation) => scopedEmployeeIds.has(evaluation.employeeId));

  const locationIds = [
    ...scopedEmployees.map((employee) => employee.currentDivisionId),
    ...scopedEmployees.map((employee) => employee.currentRegionId),
    ...scopedEmployees.map((employee) => employee.currentShopId)
  ].filter((id): id is string => Boolean(id));
  const departmentIds = scopedEmployees
    .map((employee) => employee.currentDepartmentId)
    .filter((id): id is string => Boolean(id));

  const [locations, departments] = await Promise.all([
    prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } })
  ]);

  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const currentPeriodEmployeeIds = new Set(
    scopedEvaluations
      .filter((evaluation) => evaluation.evaluationPeriodStart <= now && evaluation.evaluationPeriodEnd >= now)
      .map((evaluation) => evaluation.employeeId)
  );

  return {
    totalEmployees: scopedEmployees.length,
    activeEmployees: scopedEmployees.filter((employee) => employee.employmentStatus === "ACTIVE").length,
    onboardingPending: scopedEmployees.filter((employee) => employee.employmentStatus === "ONBOARDING").length,
    missingManagerCount: scopedEmployees.filter((employee) => !employee.directManagerId && !["CEO", "OTHER"].includes(employee.currentRole)).length,
    missingEmploymentTypeCount: scopedEmployees.filter((employee) => !employee.employmentType).length,
    salaryReadyEmployeeCount: scopedEmployees.filter(
      (employee) =>
        ["ACTIVE", "ON_PROBATION"].includes(employee.employmentStatus) &&
        Boolean(employee.employmentType) &&
        Boolean(employee.basicSalary)
    ).length,
    byDivision: countBy(scopedEmployees.map((employee) => labelLocation(employee.currentDivisionId, locationNames))),
    byDepartment: countBy(scopedEmployees.map((employee) => labelDepartment(employee.currentDepartmentId, departmentNames))),
    byRegion: countBy(scopedEmployees.map((employee) => labelLocation(employee.currentRegionId, locationNames))),
    byShop: countBy(scopedEmployees.map((employee) => labelLocation(employee.currentShopId, locationNames))),
    byRole: countBy(scopedEmployees.map((employee) => employee.currentRole)),
    byEmploymentType: countBy(scopedEmployees.map((employee) => employee.employmentType ?? "UNSPECIFIED")),
    recentlyAddedEmployees: scopedEmployees.slice(0, 10).map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      currentRole: employee.currentRole,
      employmentStatus: employee.employmentStatus,
      createdAt: employee.createdAt
    })),
    importHistorySummary,
    importValidationIssues: importValidationIssues.map((row) => ({ label: row.severity, value: row._count._all })),
    documentsByType: countBy(scopedDocuments.map((document) => document.documentType)),
    employeesMissingRequiredDocuments: scopedEmployees.filter(
      (employee) => !employee.documents.some((document) => document.documentType === "CONTRACT")
    ).length,
    leaveByStatus: countBy(scopedLeaveRecords.map((record) => record.approvalStatus)),
    leaveByDepartment: countBy(scopedLeaveRecords.map((record) => labelDepartment(record.employee.currentDepartmentId, departmentNames))),
    leaveByShop: countBy(scopedLeaveRecords.map((record) => labelLocation(record.employee.currentShopId, locationNames))),
    achievementsByEmployee: countBy(scopedAchievements.map((achievement) => `${achievement.employee.employeeId} - ${achievement.employee.fullName}`)),
    achievementsByDepartment: countBy(scopedAchievements.map((achievement) => labelDepartment(achievement.employee.currentDepartmentId, departmentNames))),
    achievementsByShop: countBy(scopedAchievements.map((achievement) => labelLocation(achievement.employee.currentShopId, locationNames))),
    evaluationByStatus: countBy(scopedEvaluations.map((evaluation) => evaluation.status)),
    evaluationByRating: countBy(scopedEvaluations.map((evaluation) => evaluation.rating ?? "UNRATED")),
    pendingEvaluations: scopedEvaluations.filter((evaluation) => ["DRAFT", "SUBMITTED", "REVIEWED"].includes(evaluation.status)).length,
    overdueEvaluations: scopedEvaluations.filter(
      (evaluation) => ["DRAFT", "SUBMITTED"].includes(evaluation.status) && evaluation.evaluationPeriodEnd < now
    ).length,
    employeesWithoutEvaluationCurrentPeriod: scopedEmployees.filter((employee) => !currentPeriodEmployeeIds.has(employee.id)).length
  };
}

function canSeeCompanyReports(principal?: Principal): boolean {
  if (!principal) return true;
  return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "CEO", "AUDITOR"]);
}

function employeeToReportScope(employee: {
  id: string;
  currentRole: string;
  currentDepartmentId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
}) {
  return {
    id: employee.id,
    currentRole: employee.currentRole as EmployeeRoleValue,
    currentDepartmentId: employee.currentDepartmentId,
    currentRegionId: employee.currentRegionId,
    currentShopId: employee.currentShopId,
    currentClusterId: employee.currentClusterId,
    directManagerId: employee.directManagerId
  };
}

function labelLocation(id: string | null, names: Map<string, string>): string {
  return id ? names.get(id) ?? id : "Unassigned";
}

function labelDepartment(id: string | null, names: Map<string, string>): string {
  return id ? names.get(id) ?? id : "Unassigned";
}

function countBy(values: string[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}
