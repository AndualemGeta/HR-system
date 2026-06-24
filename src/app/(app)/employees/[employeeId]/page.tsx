import { notFound } from "next/navigation";
import { OnboardingWorkflow } from "@/components/employees/onboarding-workflow";
import { Badge } from "@/components/ui/badge";
import { onboardingItems } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";
import { canViewEmployee, canViewSalary } from "@/lib/rbac";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const principal = await requirePagePermission("employee.view");
  const salaryVisible = canViewSalary(principal);

  const { employeeId } = await params;
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [{ id: employeeId }, { employeeId }]
    },
    include: {
      currentDepartment: true,
      currentDivision: true,
      currentRegion: true,
      currentShop: true,
      currentCluster: true,
      directManager: { select: { fullName: true } },
      currentEvaluator: { select: { fullName: true } },
      onboardingChecklist: {
        include: {
          items: {
            orderBy: { label: "asc" }
          }
        }
      },
      statusHistory: {
        orderBy: { effectiveDate: "desc" },
        take: 3
      }
    }
  });

  if (!employee) {
    notFound();
  }
  if (
    !canViewEmployee(principal, {
      id: employee.id,
      currentRole: employee.currentRole,
      currentDepartmentId: employee.currentDepartmentId,
      currentRegionId: employee.currentRegionId,
      currentShopId: employee.currentShopId,
      currentClusterId: employee.currentClusterId,
      directManagerId: employee.directManagerId
    })
  ) {
    notFound();
  }

  const salaryRecords = salaryVisible
    ? await prisma.employeeSalary.findMany({
        where: { employeeId: employee.id },
        orderBy: { effectiveDate: "desc" },
        take: 5
      })
    : [];

  const location =
    employee.currentCluster?.name ??
    employee.currentShop?.name ??
    employee.currentRegion?.name ??
    employee.currentDivision?.name ??
    "Unassigned";
  const onboardingComplete = employee.onboardingChecklist?.items.every((item) => item.completed) ?? false;
  const checklistItems =
    employee.onboardingChecklist?.items.map((item) => ({
      key: item.key,
      label: item.label,
      completed: item.completed
    })) ?? onboardingItems.map(([key, label]) => ({ key, label, completed: false }));

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{employee.fullName}</h2>
          <p>
            {employee.employeeId} - {employee.currentRole} - {location}
          </p>
        </div>
        <Badge tone={employee.employmentStatus === "ACTIVE" ? "green" : "amber"}>{employee.employmentStatus}</Badge>
      </header>
      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h3>Profile</h3>
            <span>Master record</span>
          </div>
          <div className="matrix">
            <div className="mini-card">
              <span>Department</span>
              <strong>{employee.currentDepartment?.name ?? "Unassigned"}</strong>
            </div>
            <div className="mini-card">
              <span>Direct manager</span>
              <strong>{employee.directManager?.fullName ?? "Unassigned"}</strong>
            </div>
            <div className="mini-card">
              <span>Current role</span>
              <strong>{employee.currentRole}</strong>
            </div>
            <div className="mini-card">
              <span>Location</span>
              <strong>{location}</strong>
            </div>
          </div>
        </section>
        {salaryVisible && (
          <section className="panel">
            <div className="panel-header">
              <h3>Salary</h3>
              <span>Restricted section</span>
            </div>
            <div className="matrix">
              <div className="mini-card">
                <span>Current basic salary</span>
                <strong>{employee.basicSalary ? Number(employee.basicSalary).toLocaleString() : "Not set"}</strong>
              </div>
              <div className="mini-card">
                <span>Effective date</span>
                <strong>{employee.salaryEffectiveDate?.toLocaleDateString() ?? "Not set"}</strong>
              </div>
            </div>
            <ul className="timeline" style={{ marginTop: 16 }}>
              {salaryRecords.map((salary) => (
                <li key={salary.id}>
                  <strong>{Number(salary.basicSalary).toLocaleString()}</strong>
                  <span>
                    {salary.reason} - {salary.effectiveDate.toLocaleDateString()}
                  </span>
                </li>
              ))}
              {salaryRecords.length === 0 && (
                <li>
                  <strong>No salary history</strong>
                  <span>Salary records will appear here after HR Admin updates them.</span>
                </li>
              )}
            </ul>
          </section>
        )}
        <section className="panel">
          <div className="panel-header">
            <h3>Lifecycle</h3>
            <span>Recent activity</span>
          </div>
          <ul className="timeline">
            <li>
              <strong>Status set to {employee.employmentStatus}</strong>
              <span>{employee.statusHistory[0]?.reason ?? "Current employee status"}</span>
            </li>
            <li>
              <strong>Evaluator {employee.currentEvaluator ? "assigned" : "not assigned"}</strong>
              <span>{employee.currentEvaluator?.fullName ?? "Evaluator assignment is still pending"}</span>
            </li>
            <li>
              <strong>Onboarding {onboardingComplete ? "complete" : "open"}</strong>
              <span>Required before ACTIVE or ON_PROBATION</span>
            </li>
          </ul>
        </section>
      </div>
      <OnboardingWorkflow
        employeeId={employee.employeeId}
        initialItems={checklistItems}
        initialProfile={{
          firstName: employee.firstName,
          middleName: employee.middleName ?? "",
          lastName: employee.lastName,
          email: employee.email ?? "",
          phoneNumber: employee.phoneNumber ?? "",
          address: employee.address ?? "",
          employmentType: employee.employmentType ?? "",
          employmentStatus: employee.employmentStatus,
          statusReason: "Onboarding profile update"
        }}
      />
    </>
  );
}
