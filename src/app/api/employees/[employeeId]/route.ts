import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { validateEmployeeLifecycle, validateStatusTransition } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { serializeEmployeeForPrincipal } from "@/lib/employee-serialization";
import { canUpdateSalary, canViewEmployee, canViewSalary, hasAnySystemRole, hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

const stringOrNull = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const emailOrNull = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Invalid email")
  .nullable()
  .optional();

const numberOrNull = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().nullable().optional()
);

const employeePatchSchema = z.object({
  firstName: z.string().min(1).optional(),
  middleName: stringOrNull,
  lastName: z.string().min(1).optional(),
  phoneNumber: stringOrNull,
  email: emailOrNull,
  address: stringOrNull,
  dateOfBirth: stringOrNull,
  hireDate: stringOrNull,
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "COMMISSION_BASED", "CONTRACT", "INTERN", "TEMPORARY", "OTHER"])
    .nullable()
    .optional(),
  employmentStatus: z
    .enum([
      "DRAFT",
      "ONBOARDING",
      "ACTIVE",
      "ON_PROBATION",
      "SUSPENDED",
      "ON_LEAVE",
      "TRANSFERRED",
      "RESIGNED",
      "TERMINATED",
      "EXITED"
    ])
    .optional(),
  currentRole: z
    .enum([
      "CEO",
      "CEO_COORDINATOR",
      "SALES_HEAD",
      "AREA_SALES_MANAGER",
      "SHOP_MANAGER",
      "SHOP_ACCOUNTANT",
      "DSA",
      "DSP",
      "BA_COORDINATOR",
      "CLEANING_STAFF",
      "SECURITY_STAFF",
      "EBU_SUPERVISOR",
      "EBU_FTTH_SUPERVISOR",
      "EBU_TECHNICAL_SALES_LEAD",
      "EBU_FTTH_SALES",
      "DISTRIBUTION_MANAGER",
      "DISTRIBUTION_OFFICER",
      "FINANCE_DIRECTOR",
      "TREASURY_MANAGER",
      "ACCOUNTANT",
      "FINANCIAL_CONTROL_REPORTING_MANAGER",
      "HR_MANAGER",
      "HR_OFFICER",
      "TECHNOLOGY_MANAGER",
      "EMPLOYEE",
      "OTHER"
    ])
    .optional(),
  currentLevel: z
    .enum(["JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "EXECUTIVE", "TO_BE_DEFINED"])
    .optional(),
  currentDepartmentId: stringOrNull,
  currentDivisionId: stringOrNull,
  currentRegionId: stringOrNull,
  currentShopId: stringOrNull,
  currentClusterId: stringOrNull,
  directManagerId: stringOrNull,
  currentEvaluatorId: stringOrNull,
  basicSalary: numberOrNull,
  salaryEffectiveDate: stringOrNull,
  statusReason: stringOrNull,
  effectiveDate: stringOrNull,
  onboardingOverrideReason: stringOrNull,
  approvalStatus: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional()
});

export async function GET(_request: Request, context: RouteContext) {
  const principal = await requirePermission("employee.view");
  if (isApiError(principal)) return principal;
  const { employeeId } = await context.params;
  const salaryVisible = canViewSalary(principal);

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
      directManager: { select: { id: true, employeeId: true, fullName: true } },
      currentEvaluator: { select: { id: true, employeeId: true, fullName: true } },
      assignments: { orderBy: { startDate: "desc" } },
      statusHistory: { orderBy: { effectiveDate: "desc" } },
      evaluationsReceived: { orderBy: { createdAt: "desc" }, take: 10 },
      ...(salaryVisible ? { salaries: { orderBy: { effectiveDate: "desc" as const }, take: 10 } } : {}),
      documents: { orderBy: { uploadedAt: "desc" }, take: 10 },
      achievements: { orderBy: { achievementDate: "desc" }, take: 10 },
      onboardingChecklist: { include: { items: true } }
    }
  });

  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
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
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }
  return NextResponse.json({ employee: serializeEmployeeForPrincipal(employee, salaryVisible) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("employee.update");
  if (isApiError(principal)) return principal;
  const { employeeId } = await context.params;

  const existing = await prisma.employee.findFirst({
    where: {
      OR: [{ id: employeeId }, { employeeId }]
    },
    include: { onboardingChecklist: { include: { items: true } }, assignments: true }
  });

  if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (
    !canViewEmployee(principal, {
      id: existing.id,
      currentRole: existing.currentRole,
      currentDepartmentId: existing.currentDepartmentId,
      currentRegionId: existing.currentRegionId,
      currentShopId: existing.currentShopId,
      currentClusterId: existing.currentClusterId,
      directManagerId: existing.directManagerId
    })
  ) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const parsed = employeePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid employee update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const nextStatus = payload.employmentStatus ?? existing.employmentStatus;
  const onboardingComplete = existing.onboardingChecklist?.items.every((item) => item.completed) ?? false;
  const onboardingOverride = payload.onboardingOverrideReason?.trim() || null;
  const statusChanged = Boolean(payload.employmentStatus && payload.employmentStatus !== existing.employmentStatus);
  const salaryTouched = payload.basicSalary !== undefined || payload.salaryEffectiveDate !== undefined;
  const assignmentChanged = hasAssignmentChange(payload, existing);

  if (statusChanged && !hasPermission(principal, "status.update")) {
    return NextResponse.json({ error: "Permission denied for status updates." }, { status: 403 });
  }

  if (assignmentChanged && !hasPermission(principal, "assignment.update")) {
    return NextResponse.json({ error: "Permission denied for assignment updates." }, { status: 403 });
  }

  if (salaryTouched && !canUpdateSalary(principal)) {
    return NextResponse.json({ error: "Permission denied for salary updates." }, { status: 403 });
  }

  if (onboardingOverride && !hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Only Super Admin or HR Admin can override onboarding completion." }, { status: 403 });
  }

  const nextFullName = [
    payload.firstName ?? existing.firstName,
    payload.middleName !== undefined ? payload.middleName : existing.middleName,
    payload.lastName ?? existing.lastName
  ]
    .filter(Boolean)
    .join(" ");

  const validation = validateEmployeeLifecycle({
    employeeId: existing.employeeId,
    fullName: nextFullName,
    employmentType: payload.employmentType ?? existing.employmentType,
    employmentStatus: nextStatus,
    currentRole: payload.currentRole ?? existing.currentRole,
    currentDepartmentId: payload.currentDepartmentId ?? existing.currentDepartmentId,
    currentRegionId: payload.currentRegionId ?? existing.currentRegionId,
    currentShopId: payload.currentShopId ?? existing.currentShopId,
    currentClusterId: payload.currentClusterId ?? existing.currentClusterId,
    directManagerId: payload.directManagerId ?? existing.directManagerId,
    currentEvaluatorId: payload.currentEvaluatorId ?? existing.currentEvaluatorId,
    basicSalary: payload.basicSalary ?? existing.basicSalary?.toString() ?? null,
    onboardingComplete: onboardingComplete || Boolean(onboardingOverride),
    activeAssignmentCount: existing.assignments.filter((assignment) => !assignment.endDate).length
  });

  if (statusChanged && payload.employmentStatus) {
    const statusValidation = validateStatusTransition(existing.employmentStatus, payload.employmentStatus);
    validation.blockers.push(...statusValidation.blockers);
    validation.warnings.push(...statusValidation.warnings);
    validation.reviewItems.push(...statusValidation.reviewItems);
  }

  if (validation.blockers.length > 0) {
    return NextResponse.json({ validation }, { status: 422 });
  }

  const salaryEffectiveDateUpdate =
    payload.salaryEffectiveDate !== undefined
      ? payload.salaryEffectiveDate
        ? new Date(payload.salaryEffectiveDate)
        : null
      : payload.basicSalary !== undefined
        ? payload.basicSalary === null
          ? null
          : new Date()
        : undefined;

  const updateData: Prisma.EmployeeUncheckedUpdateInput = {
    ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
    ...(payload.middleName !== undefined ? { middleName: payload.middleName } : {}),
    ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
    fullName: nextFullName,
    ...(payload.phoneNumber !== undefined ? { phoneNumber: payload.phoneNumber } : {}),
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.address !== undefined ? { address: payload.address } : {}),
    ...(payload.dateOfBirth !== undefined
      ? { dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null }
      : {}),
    ...(payload.hireDate !== undefined ? { hireDate: payload.hireDate ? new Date(payload.hireDate) : null } : {}),
    ...(payload.employmentType !== undefined ? { employmentType: payload.employmentType } : {}),
    ...(payload.employmentStatus !== undefined ? { employmentStatus: payload.employmentStatus } : {}),
    ...(payload.currentRole !== undefined ? { currentRole: payload.currentRole } : {}),
    ...(payload.currentLevel !== undefined ? { currentLevel: payload.currentLevel } : {}),
    ...(payload.currentDepartmentId !== undefined ? { currentDepartmentId: payload.currentDepartmentId } : {}),
    ...(payload.currentDivisionId !== undefined ? { currentDivisionId: payload.currentDivisionId } : {}),
    ...(payload.currentRegionId !== undefined ? { currentRegionId: payload.currentRegionId } : {}),
    ...(payload.currentShopId !== undefined ? { currentShopId: payload.currentShopId } : {}),
    ...(payload.currentClusterId !== undefined ? { currentClusterId: payload.currentClusterId } : {}),
    ...(payload.directManagerId !== undefined ? { directManagerId: payload.directManagerId } : {}),
    ...(payload.currentEvaluatorId !== undefined ? { currentEvaluatorId: payload.currentEvaluatorId } : {}),
    ...(payload.basicSalary !== undefined ? { basicSalary: payload.basicSalary } : {}),
    ...(salaryEffectiveDateUpdate !== undefined ? { salaryEffectiveDate: salaryEffectiveDateUpdate } : {}),
    updatedById: principal.id
  };

  const updated = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.update({
      where: { id: existing.id },
      data: updateData
    });

    if (statusChanged && payload.employmentStatus) {
      await tx.employeeStatusHistory.create({
        data: {
          employeeId: existing.id,
          previousStatus: existing.employmentStatus,
          newStatus: payload.employmentStatus,
          reason: onboardingOverride
            ? `${payload.statusReason ?? "Status updated"} Onboarding override: ${onboardingOverride}`
            : payload.statusReason ?? "Status updated",
          effectiveDate: payload.effectiveDate ? new Date(payload.effectiveDate) : new Date(),
          updatedById: principal.id,
          approvalStatus: payload.approvalStatus ?? "PENDING"
        }
      });
    }

    if (assignmentChanged) {
      const startDate = payload.effectiveDate ? new Date(payload.effectiveDate) : new Date();
      await tx.employeeAssignment.updateMany({
        where: {
          employeeId: existing.id,
          endDate: null
        },
        data: {
          endDate: startDate
        }
      });

      await tx.employeeAssignment.create({
        data: {
          employeeId: existing.id,
          divisionId: employee.currentDivisionId,
          departmentId: employee.currentDepartmentId,
          regionId: employee.currentRegionId,
          shopId: employee.currentShopId,
          clusterId: employee.currentClusterId,
          role: employee.currentRole,
          level: employee.currentLevel,
          directManagerId: employee.directManagerId,
          evaluatorId: employee.currentEvaluatorId,
          startDate,
          reason: payload.statusReason ?? "Assignment updated",
          approvedById: principal.id
        }
      });
    }

    if (payload.basicSalary !== undefined && payload.basicSalary !== null) {
      await tx.employeeSalary.create({
        data: {
          employeeId: existing.id,
          basicSalary: payload.basicSalary,
          effectiveDate: salaryEffectiveDateUpdate instanceof Date ? salaryEffectiveDateUpdate : new Date(),
          reason: payload.statusReason ?? "Salary updated",
          createdById: principal.id,
          approvedById: principal.id
        }
      });
    }

    return employee;
  });

  await writeAuditLog({
    userId: principal.id,
    action: "EMPLOYEE_UPDATE",
    entityType: "Employee",
    entityId: updated.id,
    oldValue: {
      employeeId: existing.employeeId,
      fullName: existing.fullName,
      employmentStatus: existing.employmentStatus,
      employmentType: existing.employmentType,
      currentRole: existing.currentRole
    },
    newValue: {
      employeeId: updated.employeeId,
      fullName: updated.fullName,
      employmentStatus: updated.employmentStatus,
      employmentType: updated.employmentType,
      currentRole: updated.currentRole
    }
  });

  if (statusChanged && payload.employmentStatus) {
    await writeAuditLog({
      userId: principal.id,
      action: "STATUS_CHANGE",
      entityType: "EmployeeStatusHistory",
      entityId: updated.id,
      oldValue: { employmentStatus: existing.employmentStatus },
      newValue: { employmentStatus: payload.employmentStatus, onboardingOverrideReason: onboardingOverride }
    });
  }

  if (assignmentChanged) {
    await writeAuditLog({
      userId: principal.id,
      action: "ASSIGNMENT_CHANGE",
      entityType: "EmployeeAssignment",
      entityId: updated.id,
      oldValue: assignmentSnapshot(existing),
      newValue: assignmentSnapshot(updated)
    });
  }

  if (payload.employmentType !== undefined && payload.employmentType !== existing.employmentType) {
    await writeAuditLog({
      userId: principal.id,
      action: "EMPLOYMENT_TYPE_CHANGE",
      entityType: "Employee",
      entityId: updated.id,
      oldValue: { employmentType: existing.employmentType },
      newValue: { employmentType: payload.employmentType }
    });
  }

  if (salaryTouched) {
    await writeAuditLog({
      userId: principal.id,
      action: "SALARY_CHANGE",
      entityType: "EmployeeSalary",
      entityId: updated.id,
      oldValue: { hadSalary: Boolean(existing.basicSalary), salaryEffectiveDate: existing.salaryEffectiveDate },
      newValue: { hadSalary: Boolean(updated.basicSalary), salaryEffectiveDate: updated.salaryEffectiveDate }
    });
  }

  return NextResponse.json({ employee: serializeEmployeeForPrincipal(updated, canViewSalary(principal)), validation });
}

function hasAssignmentChange(
  payload: z.infer<typeof employeePatchSchema>,
  existing: {
    currentRole: string;
    currentLevel: string;
    currentDepartmentId: string | null;
    currentDivisionId: string | null;
    currentRegionId: string | null;
    currentShopId: string | null;
    currentClusterId: string | null;
    directManagerId: string | null;
    currentEvaluatorId: string | null;
  }
): boolean {
  return (
    (payload.currentRole !== undefined && payload.currentRole !== existing.currentRole) ||
    (payload.currentLevel !== undefined && payload.currentLevel !== existing.currentLevel) ||
    (payload.currentDepartmentId !== undefined && payload.currentDepartmentId !== existing.currentDepartmentId) ||
    (payload.currentDivisionId !== undefined && payload.currentDivisionId !== existing.currentDivisionId) ||
    (payload.currentRegionId !== undefined && payload.currentRegionId !== existing.currentRegionId) ||
    (payload.currentShopId !== undefined && payload.currentShopId !== existing.currentShopId) ||
    (payload.currentClusterId !== undefined && payload.currentClusterId !== existing.currentClusterId) ||
    (payload.directManagerId !== undefined && payload.directManagerId !== existing.directManagerId) ||
    (payload.currentEvaluatorId !== undefined && payload.currentEvaluatorId !== existing.currentEvaluatorId)
  );
}

function assignmentSnapshot(employee: {
  currentRole: string;
  currentLevel: string;
  currentDepartmentId: string | null;
  currentDivisionId: string | null;
  currentRegionId: string | null;
  currentShopId: string | null;
  currentClusterId: string | null;
  directManagerId: string | null;
  currentEvaluatorId: string | null;
}) {
  return {
    role: employee.currentRole,
    level: employee.currentLevel,
    departmentId: employee.currentDepartmentId,
    divisionId: employee.currentDivisionId,
    regionId: employee.currentRegionId,
    shopId: employee.currentShopId,
    clusterId: employee.currentClusterId,
    directManagerId: employee.directManagerId,
    evaluatorId: employee.currentEvaluatorId
  };
}
