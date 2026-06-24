import { canViewEmployee, hasAnySystemRole, type Principal } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function getPhase3Reports(principal: Principal) {
  const [employees, disciplinaryRecords, terminationCases, transferRequests, promotionRequests, approvalRequests] =
    await Promise.all([
      prisma.employee.findMany(),
      prisma.disciplinaryRecord.findMany({ include: { employee: true }, take: 1000 }),
      prisma.terminationCase.findMany({ include: { employee: true, exitItems: true }, take: 1000 }),
      prisma.transferRequest.findMany({ include: { employee: true }, take: 1000 }),
      prisma.promotionRequest.findMany({ include: { employee: true }, take: 1000 }),
      prisma.approvalRequest.findMany({
        include: {
          workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
          actions: { orderBy: { actionDate: "asc" } }
        },
        take: 1000
      })
    ]);

  const visibleEmployeeIds = new Set(
    employees
      .filter((employee) =>
        canViewEmployee(principal, {
          id: employee.id,
          currentRole: employee.currentRole,
          currentDepartmentId: employee.currentDepartmentId,
          currentRegionId: employee.currentRegionId,
          currentShopId: employee.currentShopId,
          currentClusterId: employee.currentClusterId,
          directManagerId: employee.directManagerId
        })
      )
      .map((employee) => employee.id)
  );

  const scopedDisciplinary = disciplinaryRecords.filter((record) => visibleEmployeeIds.has(record.employeeId));
  const scopedTerminations = terminationCases.filter((termination) => visibleEmployeeIds.has(termination.employeeId));
  const scopedTransfers = transferRequests.filter((transfer) => visibleEmployeeIds.has(transfer.employeeId));
  const scopedPromotions = promotionRequests.filter((promotion) => visibleEmployeeIds.has(promotion.employeeId));
  const approvalMetrics = hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "CEO", "AUDITOR"])
    ? approvalRequests
    : approvalRequests.filter((request) => request.requestedById === principal.id);

  return {
    disciplinaryByStatus: countBy(scopedDisciplinary.map((record) => record.status)),
    disciplinaryByIncidentType: countBy(scopedDisciplinary.map((record) => record.incidentType)),
    openDisciplinaryFollowUps: scopedDisciplinary.filter(
      (record) => Boolean(record.followUpDate) && !["CLOSED", "REJECTED"].includes(record.status)
    ).length,
    terminationByStatus: countBy(scopedTerminations.map((termination) => termination.status)),
    exitClearancePending: scopedTerminations.filter((termination) => termination.clearanceStatus !== "COMPLETED").length,
    finalPaymentPending: scopedTerminations.filter((termination) =>
      ["NOT_STARTED", "PENDING_REVIEW", "ON_HOLD"].includes(termination.finalPaymentStatus)
    ).length,
    transferByStatus: countBy(scopedTransfers.map((transfer) => transfer.status)),
    promotionByStatus: countBy(scopedPromotions.map((promotion) => promotion.status)),
    approvedPromotionsByPeriod: countBy(
      scopedPromotions
        .filter((promotion) => ["APPROVED", "COMPLETED"].includes(promotion.status))
        .map((promotion) => periodLabel(promotion.effectiveDate ?? promotion.updatedAt))
    ),
    approvalRequestsPendingByApprover: countBy(
      approvalMetrics
        .filter((request) => ["SUBMITTED", "IN_PROGRESS"].includes(request.status))
        .map((request) => currentApproverLabel(request))
    ),
    approvalTurnaroundDays: average(
      approvalMetrics
        .filter((request) => ["APPROVED", "REJECTED"].includes(request.status))
        .map((request) => daysBetween(request.createdAt, request.updatedAt))
    ),
    repeatedDisciplinaryEmployees: countBy(scopedDisciplinary.map((record) => `${record.employee.employeeId} - ${record.employee.fullName}`))
      .filter((row) => row.value > 1),
    employeesTransferredByPeriod: countBy(
      scopedTransfers
        .filter((transfer) => transfer.status === "COMPLETED")
        .map((transfer) => periodLabel(transfer.effectiveDate ?? transfer.updatedAt))
    ),
    employeesPromotedByPeriod: countBy(
      scopedPromotions
        .filter((promotion) => promotion.status === "COMPLETED")
        .map((promotion) => periodLabel(promotion.effectiveDate ?? promotion.updatedAt))
    ),
    exitCompletionTimeDays: average(
      scopedTerminations
        .filter((termination) => termination.status === "EXIT_COMPLETED")
        .map((termination) => daysBetween(termination.createdAt, termination.updatedAt))
    ),
    employeeLifecycleSummary: [
      { label: "Active employees", value: employees.filter((employee) => visibleEmployeeIds.has(employee.id) && employee.employmentStatus === "ACTIVE").length },
      { label: "Transfers completed", value: scopedTransfers.filter((transfer) => transfer.status === "COMPLETED").length },
      { label: "Promotions completed", value: scopedPromotions.filter((promotion) => promotion.status === "COMPLETED").length },
      { label: "Open exits", value: scopedTerminations.filter((termination) => !["EXIT_COMPLETED", "CANCELLED", "REJECTED"].includes(termination.status)).length }
    ]
  };
}

function currentApproverLabel(request: {
  currentStep: number;
  workflow: { steps: Array<{ stepOrder: number; approverRole: string | null; approverUserId: string | null }> };
}) {
  const step = request.workflow.steps.find((candidate) => candidate.stepOrder === request.currentStep);
  return step?.approverRole ?? step?.approverUserId ?? "Unassigned";
}

function periodLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function countBy(values: string[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}
