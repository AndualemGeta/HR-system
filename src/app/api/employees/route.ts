import { EmploymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { isValidEmployeeId, nextEmployeeId } from "@/lib/employee-id";
import { onboardingItems } from "@/lib/constants";
import { validateEmployeeLifecycle } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { serializeEmployeesForPrincipal, serializeEmployeeForPrincipal } from "@/lib/employee-serialization";
import { canUpdateSalary, canViewEmployee, canViewSalary, hasAnySystemRole } from "@/lib/rbac";

export const runtime = "nodejs";

const stringOrNull = z
  .string()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional();

const emailOrNull = z
  .string()
  .transform((val) => (val === "" ? null : val))
  .refine((val) => val === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email")
  .nullable()
  .optional();

const numberOrNull = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().nullable().optional()
);

const employeeCreateSchema = z.object({
  employeeId: stringOrNull,
  firstName: z.string().min(1),
  middleName: stringOrNull,
  lastName: z.string().min(1),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "NOT_SPECIFIED"]).default("NOT_SPECIFIED"),
  dateOfBirth: stringOrNull,
  phoneNumber: stringOrNull,
  email: emailOrNull,
  address: stringOrNull,
  hireDate: stringOrNull,
  employmentType: z
    .string()
    .transform((val) => (val === "" ? null : val))
    .pipe(
      z.enum(["FULL_TIME", "PART_TIME", "COMMISSION_BASED", "CONTRACT", "INTERN", "TEMPORARY", "OTHER"]).nullable().optional()
    )
    .default("FULL_TIME"),
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
    .default("DRAFT"),
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
    .default("OTHER"),
  currentLevel: z
    .enum(["JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "EXECUTIVE", "TO_BE_DEFINED"])
    .default("TO_BE_DEFINED"),
  currentDepartmentId: stringOrNull,
  currentDivisionId: stringOrNull,
  currentRegionId: stringOrNull,
  currentShopId: stringOrNull,
  currentClusterId: stringOrNull,
  directManagerId: stringOrNull,
  currentEvaluatorId: stringOrNull,
  basicSalary: numberOrNull,
  salaryEffectiveDate: stringOrNull,
  onboardingOverrideReason: stringOrNull
});

export async function GET(request: Request) {
  const principal = await requirePermission("employee.view");
  if (isApiError(principal)) return principal;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      ...(status ? { employmentStatus: status as EmploymentStatus } : {}),
      ...(query
        ? {
            OR: [
              { employeeId: { contains: query, mode: "insensitive" } },
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phoneNumber: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      currentDepartment: true,
      currentRegion: true,
      currentShop: true,
      currentCluster: true,
      directManager: { select: { id: true, employeeId: true, fullName: true } },
      currentEvaluator: { select: { id: true, employeeId: true, fullName: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const scopedEmployees = employees.filter((employee) =>
    canViewEmployee(principal, {
      id: employee.id,
      currentRole: employee.currentRole,
      currentDepartmentId: employee.currentDepartmentId,
      currentRegionId: employee.currentRegionId,
      currentShopId: employee.currentShopId,
      currentClusterId: employee.currentClusterId,
      directManagerId: employee.directManagerId
    })
  );

  return NextResponse.json({
    employees: serializeEmployeesForPrincipal(scopedEmployees, canViewSalary(principal))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("employee.create");
  if (isApiError(principal)) return principal;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
    
    const parsed = employeeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid employee create request.", details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    if ((payload.basicSalary !== undefined || payload.salaryEffectiveDate) && !canUpdateSalary(principal)) {
      return NextResponse.json({ error: "Permission denied for salary updates." }, { status: 403 });
    }

    const onboardingOverride = payload.onboardingOverrideReason?.trim() || null;
    if (onboardingOverride && !hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"])) {
      return NextResponse.json({ error: "Only Super Admin or HR Admin can override onboarding completion." }, { status: 403 });
    }

    const employeeIds = await prisma.employee.findMany({ select: { employeeId: true } });
    const existingEmployeeIds = employeeIds.map((employee) => employee.employeeId);
    const requestedEmployeeId = payload.employeeId?.trim() || null;

    if (requestedEmployeeId && !isValidEmployeeId(requestedEmployeeId)) {
      return NextResponse.json(
        { error: "Invalid employee ID.", details: "Employee ID must follow the LSTA_0001 format." },
        { status: 400 }
      );
    }

    if (requestedEmployeeId && existingEmployeeIds.includes(requestedEmployeeId)) {
      return NextResponse.json({ error: "Employee ID already exists." }, { status: 409 });
    }

    const employeeId = requestedEmployeeId ?? nextEmployeeId(existingEmployeeIds);
    const fullName = [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(" ");

    if (payload.currentDepartmentId) {
      const dept = await prisma.department.findUnique({ where: { id: payload.currentDepartmentId } });
      if (!dept) {
        return NextResponse.json(
          { error: "Invalid department ID", details: `Department ${payload.currentDepartmentId} not found` },
          { status: 400 }
        );
      }
    }

    if (payload.currentDivisionId || payload.currentRegionId || payload.currentShopId || payload.currentClusterId) {
      const locationIds = [
        payload.currentDivisionId,
        payload.currentRegionId,
        payload.currentShopId,
        payload.currentClusterId
      ].filter((id): id is string => Boolean(id));

      if (locationIds.length > 0) {
        const locations = await prisma.location.findMany({ where: { id: { in: locationIds } } });
        const foundIds = new Set(locations.map((l) => l.id));
        for (const locId of locationIds) {
          if (!foundIds.has(locId)) {
            return NextResponse.json(
              { error: "Invalid location ID", details: `Location ${locId} not found` },
              { status: 400 }
            );
          }
        }
      }
    }

    if (payload.directManagerId) {
      const manager = await prisma.employee.findUnique({ where: { id: payload.directManagerId } });
      if (!manager) {
        return NextResponse.json(
          { error: "Invalid manager ID", details: `Manager ${payload.directManagerId} not found` },
          { status: 400 }
        );
      }
    }

    if (payload.currentEvaluatorId) {
      const evaluator = await prisma.employee.findUnique({ where: { id: payload.currentEvaluatorId } });
      if (!evaluator) {
        return NextResponse.json(
          { error: "Invalid evaluator ID", details: `Evaluator ${payload.currentEvaluatorId} not found` },
          { status: 400 }
        );
      }
    }

    const lifecycle = validateEmployeeLifecycle({
      ...payload,
      employeeId,
      fullName,
      onboardingComplete:
        payload.employmentStatus === "DRAFT" || payload.employmentStatus === "ONBOARDING" || Boolean(onboardingOverride),
      activeAssignmentCount: 0
    });

    if (lifecycle.blockers.length > 0) {
      return NextResponse.json({ validation: lifecycle }, { status: 422 });
    }

    const employee = await prisma.$transaction(async (tx) => {
      const assignmentStart = payload.hireDate ? new Date(payload.hireDate) : new Date();
      const salaryEffectiveDate = payload.salaryEffectiveDate ? new Date(payload.salaryEffectiveDate) : assignmentStart;
      const created = await tx.employee.create({
        data: {
          employeeId,
          firstName: payload.firstName,
          middleName: payload.middleName,
          lastName: payload.lastName,
          fullName,
          gender: payload.gender,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
          phoneNumber: payload.phoneNumber,
          email: payload.email,
          address: payload.address,
          hireDate: payload.hireDate ? new Date(payload.hireDate) : null,
          employmentType: payload.employmentType,
          employmentStatus: payload.employmentStatus,
          currentRole: payload.currentRole,
          currentLevel: payload.currentLevel,
          currentDepartmentId: payload.currentDepartmentId,
          currentDivisionId: payload.currentDivisionId,
          currentRegionId: payload.currentRegionId,
          currentShopId: payload.currentShopId,
          currentClusterId: payload.currentClusterId,
          directManagerId: payload.directManagerId,
          currentEvaluatorId: payload.currentEvaluatorId,
          basicSalary: payload.basicSalary,
          salaryEffectiveDate: payload.basicSalary ? salaryEffectiveDate : null,
          createdById: principal.id,
          updatedById: principal.id
        }
      });

      await tx.onboardingChecklist.create({
        data: {
          employeeId: created.id,
          items: {
            create: onboardingItems.map(([key, label]) => ({ key, label }))
          }
        }
      });

      await tx.employeeAssignment.create({
        data: {
          employeeId: created.id,
          divisionId: payload.currentDivisionId,
          departmentId: payload.currentDepartmentId,
          regionId: payload.currentRegionId,
          shopId: payload.currentShopId,
          clusterId: payload.currentClusterId,
          role: payload.currentRole,
          level: payload.currentLevel,
          directManagerId: payload.directManagerId,
          evaluatorId: payload.currentEvaluatorId,
          startDate: assignmentStart,
          reason: "Initial employee assignment",
          approvedById: principal.id
        }
      });

      await tx.employeeStatusHistory.create({
        data: {
          employeeId: created.id,
          newStatus: payload.employmentStatus,
          reason: onboardingOverride
            ? `Initial employee creation. Onboarding override: ${onboardingOverride}`
            : "Initial employee creation",
          effectiveDate: new Date(),
          updatedById: principal.id,
          approvalStatus: "APPROVED"
        }
      });

      if (payload.basicSalary) {
        await tx.employeeSalary.create({
          data: {
            employeeId: created.id,
            basicSalary: payload.basicSalary,
            effectiveDate: salaryEffectiveDate,
            reason: "Initial salary record",
            createdById: principal.id,
            approvedById: principal.id
          }
        });
      }

      return created;
    });

    await writeAuditLog({
      userId: principal.id,
      action: "EMPLOYEE_CREATE",
      entityType: "Employee",
      entityId: employee.id,
      newValue: { id: employee.id, employeeId: employee.employeeId, fullName: employee.fullName }
    });

    await writeAuditLog({
      userId: principal.id,
      action: "ASSIGNMENT_CHANGE",
      entityType: "EmployeeAssignment",
      entityId: employee.id,
      newValue: {
        employeeId: employee.id,
        role: payload.currentRole,
        departmentId: payload.currentDepartmentId,
        regionId: payload.currentRegionId,
        shopId: payload.currentShopId,
        clusterId: payload.currentClusterId,
        directManagerId: payload.directManagerId
      }
    });

    await writeAuditLog({
      userId: principal.id,
      action: "STATUS_CHANGE",
      entityType: "EmployeeStatusHistory",
      entityId: employee.id,
      newValue: { newStatus: payload.employmentStatus }
    });

    if (payload.basicSalary) {
      await writeAuditLog({
        userId: principal.id,
        action: "SALARY_CHANGE",
        entityType: "EmployeeSalary",
        entityId: employee.id,
        newValue: { employeeId: employee.id, effectiveDate: payload.salaryEffectiveDate ?? null }
      });
    }

    return NextResponse.json(
      { employee: serializeEmployeeForPrincipal(employee, canViewSalary(principal)), validation: lifecycle },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (process.env.NODE_ENV === "development") {
      console.error({ event: "employee_create_error", error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    }
    return NextResponse.json(
      { error: "Failed to create employee", details: errorMessage },
      { status: 500 }
    );
  }
}
