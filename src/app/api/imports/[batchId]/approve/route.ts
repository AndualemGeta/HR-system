import { EmployeeLevel, EmployeeRole, EmploymentStatus, EmploymentType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { onboardingItems } from "@/lib/constants";
import { writeAuditLog } from "@/lib/audit";
import type { NormalizedImportRow } from "@/lib/import/validator";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    batchId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const principal = await requirePermission("import.approve");
  if (isApiError(principal)) return principal;

  const { batchId } = await context.params;
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        where: { status: { in: ["CLEAN", "WARNING"] }, createdEmployeeId: null },
        orderBy: { rowNumber: "asc" }
      }
    }
  });

  if (!batch) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
  if (batch.status === "APPROVED") {
    return NextResponse.json({ error: "Import batch has already been approved." }, { status: 409 });
  }

  const createdEmployees = await prisma.$transaction(async (tx) => {
    const created: Array<{ id: string; employeeId: string; fullName: string }> = [];

    for (const row of batch.rows) {
      const normalized = row.normalizedData as Prisma.JsonObject as unknown as NormalizedImportRow;
      if (!normalized.fullName || !normalized.employmentType) continue;

      const nameParts = normalized.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? normalized.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Imported";
      const employee = await tx.employee.create({
        data: {
          employeeId: normalized.employeeId,
          firstName,
          lastName,
          fullName: normalized.fullName,
          employmentType: normalized.employmentType as EmploymentType,
          employmentStatus: normalized.employmentStatus as EmploymentStatus,
          currentRole: (normalized.role ?? "OTHER") as EmployeeRole,
          currentLevel: normalized.level as EmployeeLevel,
          basicSalary: normalized.basicSalary ?? null,
          salaryEffectiveDate: normalized.basicSalary ? new Date() : null,
          createdById: principal.id,
          updatedById: principal.id
        }
      });

      await tx.employeeAssignment.create({
        data: {
          employeeId: employee.id,
          role: employee.currentRole,
          level: employee.currentLevel,
          startDate: new Date(),
          reason: `Created from import ${batch.fileName}`,
          approvedById: principal.id
        }
      });

      await tx.employeeStatusHistory.create({
        data: {
          employeeId: employee.id,
          newStatus: employee.employmentStatus,
          reason: `Created from import ${batch.fileName}`,
          effectiveDate: new Date(),
          updatedById: principal.id,
          approvalStatus: "APPROVED"
        }
      });

      await tx.onboardingChecklist.create({
        data: {
          employeeId: employee.id,
          items: {
            create: onboardingItems.map(([key, label]) => ({ key, label }))
          }
        }
      });

      if (normalized.basicSalary) {
        await tx.employeeSalary.create({
          data: {
            employeeId: employee.id,
            basicSalary: normalized.basicSalary,
            effectiveDate: new Date(),
            reason: `Created from import ${batch.fileName}`,
            createdById: principal.id,
            approvedById: principal.id
          }
        });
      }

      await tx.importRow.update({
        where: { id: row.id },
        data: {
          employeeCreated: true,
          createdEmployeeId: employee.id,
          notes: "Employee created during import approval."
        }
      });

      created.push({ id: employee.id, employeeId: employee.employeeId, fullName: employee.fullName });
    }

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "APPROVED",
        approvedById: principal.id,
        approvedAt: new Date(),
        notes: `Approved ${created.length} valid rows.`
      }
    });

    return created;
  });

  await writeAuditLog({
    userId: principal.id,
    action: "IMPORT_APPROVAL",
    entityType: "ImportBatch",
    entityId: batch.id,
    newValue: { createdEmployees: createdEmployees.length }
  });

  for (const employee of createdEmployees) {
    await writeAuditLog({
      userId: principal.id,
      action: "EMPLOYEE_IMPORT_CREATE",
      entityType: "Employee",
      entityId: employee.id,
      newValue: employee
    });
  }

  return NextResponse.json({ createdEmployees });
}
