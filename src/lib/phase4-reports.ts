import type { Employee, EmployeeRole, EmploymentStatus, KpiRating, PayrollReadinessStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewEmployee, hasAnySystemRole, type Principal } from "@/lib/rbac";
import {
  defaultRequiredDocumentRules,
  requiredDocumentDataQualityIssues,
  type RequiredDocumentRuleInput
} from "@/lib/required-document-rules";

type CountRow = { label: string; value: number };

export async function getPhase4Analytics(principal: Principal) {
  const [
    employees,
    payrollBatches,
    payrollRows,
    kpiResults,
    dataQualityIssues,
    reminders,
    profileChangeRequests,
    exportHistory,
    approvalRequests
  ] = await Promise.all([
    prisma.employee.findMany({ take: 3000 }),
    prisma.payrollPreparationBatch.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.payrollPreparationRow.findMany({ include: { employee: true }, take: 3000 }),
    prisma.employeeKpiResult.findMany({ include: { employee: true, metric: true }, take: 3000 }),
    prisma.dataQualityIssue.findMany({ include: { employee: true }, take: 3000 }),
    prisma.hRReminder.findMany({ include: { relatedEmployee: true }, take: 1000 }),
    prisma.employeeProfileChangeRequest.findMany({ include: { employee: true }, take: 1000 }),
    prisma.exportHistory.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.approvalRequest.findMany({
      include: { workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } } },
      take: 1000
    })
  ]);

  const visibleEmployees = employees.filter((employee) => canViewEmployee(principal, employeeScope(employee)));
  const visibleEmployeeIds = new Set(visibleEmployees.map((employee) => employee.id));
  const visiblePayrollRows = payrollRows.filter((row) => visibleEmployeeIds.has(row.employeeId));
  const visibleKpiResults = kpiResults.filter((result) => visibleEmployeeIds.has(result.employeeId));
  const visibleIssues = dataQualityIssues.filter((issue) => !issue.employeeId || visibleEmployeeIds.has(issue.employeeId));
  const visibleReminders = reminders.filter((reminder) => !reminder.relatedEmployeeId || visibleEmployeeIds.has(reminder.relatedEmployeeId));
  const visibleProfileRequests = profileChangeRequests.filter((request) => visibleEmployeeIds.has(request.employeeId));
  const governanceRequests = hasAnySystemRole(principal, ["SUPER_ADMIN", "CEO", "HR_ADMIN", "HR_MANAGER", "AUDITOR"])
    ? approvalRequests
    : approvalRequests.filter((request) => request.requestedById === principal.id);

  return {
    headcount: visibleEmployees.length,
    activeEmployees: visibleEmployees.filter((employee) => employee.employmentStatus === "ACTIVE").length,
    payrollBatchCount: payrollBatches.length,
    payrollReadiness: countBy(visiblePayrollRows.map((row) => row.readinessStatus)),
    latestPayrollBatch: payrollBatches[0]
      ? {
          id: payrollBatches[0].id,
          batchName: payrollBatches[0].batchName,
          status: payrollBatches[0].status,
          totalEmployees: payrollBatches[0].totalEmployees,
          readyCount: payrollBatches[0].readyCount,
          warningCount: payrollBatches[0].warningCount,
          blockedCount: payrollBatches[0].blockedCount
        }
      : null,
    kpiRatings: countBy(visibleKpiResults.map((result) => result.rating)),
    kpiApprovalStatus: countBy(visibleKpiResults.map((result) => result.approvalStatus)),
    averageKpiAchievement: average(
      visibleKpiResults
        .map((result) => result.achievementPercent?.toNumber())
        .filter((value): value is number => typeof value === "number")
    ),
    dataQualityBySeverity: countBy(visibleIssues.map((issue) => issue.severity)),
    openDataQualityIssues: visibleIssues.filter((issue) => !["RESOLVED", "DISMISSED"].includes(issue.status)).length,
    remindersByStatus: countBy(visibleReminders.map((reminder) => reminder.status)),
    overdueReminders: visibleReminders.filter((reminder) => reminder.status === "OVERDUE" || (reminder.status === "OPEN" && reminder.dueDate < new Date())).length,
    profileChangesByStatus: countBy(visibleProfileRequests.map((request) => request.status)),
    exportHistoryByType: countBy(exportHistory.map((entry) => entry.exportType)),
    governancePending: governanceRequests.filter((request) => ["SUBMITTED", "IN_PROGRESS"].includes(request.status)).length,
    approvalEscalationCandidates: governanceRequests.filter((request) => {
      if (!["SUBMITTED", "IN_PROGRESS"].includes(request.status)) return false;
      const step = request.workflow.steps.find((candidate) => candidate.stepOrder === request.currentStep);
      if (!step?.escalationAfterDays) return false;
      return daysBetween(request.updatedAt, new Date()) >= step.escalationAfterDays;
    }).length,
    employmentStatus: countBy(visibleEmployees.map((employee) => employee.employmentStatus)),
    roleDistribution: countBy(visibleEmployees.map((employee) => employee.currentRole))
  };
}

export async function getPhase4Compliance(principal: Principal) {
  const [employees, payrollRows, issues, reminders, workflows, profileRequests, requiredDocumentRules] = await Promise.all([
    prisma.employee.findMany({
      include: {
        documents: { where: { isActive: true }, take: 5 },
        assignments: { where: { endDate: null }, take: 3 },
        user: { select: { id: true } }
      },
      take: 3000
    }),
    prisma.payrollPreparationRow.findMany({ include: { employee: true }, take: 3000 }),
    prisma.dataQualityIssue.findMany({ include: { employee: true }, take: 3000 }),
    prisma.hRReminder.findMany({ include: { relatedEmployee: true }, take: 1000 }),
    prisma.approvalWorkflow.findMany({ include: { steps: true }, take: 100 }),
    prisma.employeeProfileChangeRequest.findMany({ include: { employee: true }, take: 1000 }),
    prisma.requiredDocumentRule.findMany({ where: { activeStatus: true }, take: 500 })
  ]);

  const visibleEmployees = employees.filter((employee) => canViewEmployee(principal, employeeScope(employee)));
  const visibleEmployeeIds = new Set(visibleEmployees.map((employee) => employee.id));
  const visiblePayrollRows = payrollRows.filter((row) => visibleEmployeeIds.has(row.employeeId));
  const visibleIssues = issues.filter((issue) => !issue.employeeId || visibleEmployeeIds.has(issue.employeeId));
  const visibleReminders = reminders.filter((reminder) => !reminder.relatedEmployeeId || visibleEmployeeIds.has(reminder.relatedEmployeeId));
  const visibleProfileRequests = profileRequests.filter((request) => visibleEmployeeIds.has(request.employeeId));
  const documentRules = requiredDocumentRules.length > 0 ? requiredDocumentRules : defaultRequiredDocumentRules;
  const generatedFindings = buildComplianceFindings(visibleEmployees, visiblePayrollRows, documentRules);

  return {
    generatedFindings,
    generatedBySeverity: countBy(generatedFindings.map((finding) => finding.severity)),
    openIssuesBySeverity: countBy(
      visibleIssues
        .filter((issue) => !["RESOLVED", "DISMISSED"].includes(issue.status))
        .map((issue) => issue.severity)
    ),
    payrollBlockedRows: visiblePayrollRows.filter((row) => row.readinessStatus === "BLOCKED").length,
    overdueReminders: visibleReminders.filter((reminder) => reminder.status === "OVERDUE" || (reminder.status === "OPEN" && reminder.dueDate < new Date())).length,
    pendingProfileChanges: visibleProfileRequests.filter((request) => request.status === "SUBMITTED").length,
    inactiveWorkflowCount: workflows.filter((workflow) => !workflow.activeStatus).length,
    workflowsWithoutEscalation: workflows.filter(
      (workflow) => workflow.activeStatus && workflow.steps.every((step) => !step.escalationAfterDays && !step.escalationRole)
    ).length,
    employeeComplianceSummary: [
      { label: "Visible employees", value: visibleEmployees.length },
      { label: "Active missing user", value: visibleEmployees.filter((employee) => employee.employmentStatus === "ACTIVE" && employee.user.length === 0).length },
      { label: "Active missing documents", value: visibleEmployees.filter((employee) => employee.employmentStatus === "ACTIVE" && employee.documents.length === 0).length },
      { label: "Multiple active assignments", value: visibleEmployees.filter((employee) => employee.assignments.length > 1).length }
    ]
  };
}

function buildComplianceFindings(
  employees: Array<Employee & { documents: Array<{ documentType: string; isActive: boolean }>; assignments: unknown[]; user: unknown[] }>,
  payrollRows: Array<{ employeeId: string; readinessStatus: PayrollReadinessStatus }>,
  requiredDocumentRules: RequiredDocumentRuleInput[]
) {
  const latestBlockedPayroll = new Set(
    payrollRows.filter((row) => row.readinessStatus === "BLOCKED").map((row) => row.employeeId)
  );
  const findings: Array<{
    employeeId: string;
    employeeCode: string;
    employee: string;
    issueType: string;
    severity: "BLOCKER" | "WARNING" | "REVIEW";
    description: string;
  }> = [];

  for (const employee of employees) {
    if (employee.employmentStatus === "ACTIVE" && !employee.employmentType) {
      findings.push(finding(employee, "MISSING_FIELD", "BLOCKER", "Active employee is missing employment type."));
    }
    findings.push(...requiredDocumentDataQualityIssues(employee, employee.documents, requiredDocumentRules));
    if (employee.assignments.length > 1) {
      findings.push(finding(employee, "MULTIPLE_ACTIVE_ASSIGNMENTS", "BLOCKER", "Employee has more than one active assignment."));
    }
    if (latestBlockedPayroll.has(employee.id)) {
      findings.push(finding(employee, "PAYROLL_BLOCKER", "BLOCKER", "Latest payroll preparation found blocker-level issues."));
    }
  }

  return findings.slice(0, 100);
}

function finding(employee: Pick<Employee, "id" | "employeeId" | "fullName">, issueType: string, severity: "BLOCKER" | "WARNING" | "REVIEW", description: string) {
  return {
    employeeId: employee.id,
    employeeCode: employee.employeeId,
    employee: employee.fullName,
    issueType,
    severity,
    description
  };
}

function employeeScope(employee: {
  id: string;
  currentRole: EmployeeRole;
  currentDepartmentId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
}) {
  return {
    id: employee.id,
    currentRole: employee.currentRole,
    currentDepartmentId: employee.currentDepartmentId,
    currentRegionId: employee.currentRegionId,
    currentShopId: employee.currentShopId,
    currentClusterId: employee.currentClusterId,
    directManagerId: employee.directManagerId
  };
}

function countBy(values: Array<string | KpiRating | EmploymentStatus | PayrollReadinessStatus>): CountRow[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}
