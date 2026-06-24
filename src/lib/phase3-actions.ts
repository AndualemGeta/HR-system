import type {
  EmployeeLevel,
  EmployeeRole,
  PromotionRequest,
  TerminationCase,
  TransferRequest
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { canUpdateSalary, type Principal } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { validateExitCompletion } from "@/lib/phase3-validation";

export async function completeTerminationExit(input: {
  principal: Principal;
  terminationId: string;
  overrideReason?: string | null;
}) {
  const termination = await prisma.terminationCase.findUnique({
    where: { id: input.terminationId },
    include: { exitItems: true, employee: { include: { user: true } } }
  });
  if (!termination) throw new Error("Termination case not found.");

  const issues = validateExitCompletion(termination.exitItems, input.overrideReason);
  if (issues.length > 0) throw new Error(issues[0].message);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employeeAssignment.updateMany({
      where: { employeeId: termination.employeeId, endDate: null },
      data: { endDate: termination.lastWorkingDate ?? new Date() }
    });
    await tx.employee.update({
      where: { id: termination.employeeId },
      data: { employmentStatus: "EXITED", updatedById: input.principal.id }
    });
    await tx.employeeStatusHistory.create({
      data: {
        employeeId: termination.employeeId,
        previousStatus: termination.employee.employmentStatus,
        newStatus: "EXITED",
        reason: input.overrideReason ? `Exit completed with override: ${input.overrideReason}` : "Exit checklist completed.",
        effectiveDate: termination.lastWorkingDate ?? new Date(),
        updatedById: input.principal.id,
        approvedById: input.principal.id,
        approvalStatus: "APPROVED"
      }
    });
    await tx.user.updateMany({
      where: { employeeId: termination.employeeId },
      data: { status: "DISABLED" }
    });
    return tx.terminationCase.update({
      where: { id: termination.id },
      data: {
        status: "EXIT_COMPLETED",
        clearanceStatus: "COMPLETED",
        exitInterviewStatus: "COMPLETED",
        notes: input.overrideReason ? `HR override: ${input.overrideReason}` : termination.notes
      },
      include: { exitItems: true, employee: true }
    });
  });

  await writeAuditLog({
    userId: input.principal.id,
    action: "TERMINATION_COMPLETE_EXIT",
    entityType: "TerminationCase",
    entityId: updated.id,
    newValue: { status: updated.status, overrideReason: input.overrideReason ?? null }
  });
  await writeAuditLog({
    userId: input.principal.id,
    action: "USER_ACCOUNT_DEACTIVATION",
    entityType: "Employee",
    entityId: termination.employeeId,
    newValue: { employeeId: termination.employeeId }
  });

  return updated;
}

export async function completeTransfer(input: { principal: Principal; transferId: string }) {
  const transfer = await prisma.transferRequest.findUnique({ where: { id: input.transferId }, include: { employee: true } });
  if (!transfer) throw new Error("Transfer request not found.");
  const effectiveDate = transfer.effectiveDate ?? new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employeeAssignment.updateMany({
      where: { employeeId: transfer.employeeId, endDate: null },
      data: { endDate: effectiveDate }
    });

    const employee = await tx.employee.update({
      where: { id: transfer.employeeId },
      data: {
        currentDivisionId: transfer.requestedDivisionId ?? transfer.employee.currentDivisionId,
        currentDepartmentId: transfer.requestedDepartmentId ?? transfer.employee.currentDepartmentId,
        currentRegionId: transfer.requestedRegionId ?? transfer.employee.currentRegionId,
        currentShopId: transfer.requestedShopId ?? transfer.employee.currentShopId,
        currentClusterId: transfer.requestedClusterId ?? transfer.employee.currentClusterId,
        currentRole: transfer.requestedRole ?? transfer.employee.currentRole,
        currentLevel: transfer.requestedLevel ?? transfer.employee.currentLevel,
        directManagerId: transfer.requestedManagerId ?? transfer.employee.directManagerId,
        updatedById: input.principal.id
      }
    });

    await tx.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        divisionId: employee.currentDivisionId,
        departmentId: employee.currentDepartmentId,
        regionId: employee.currentRegionId,
        shopId: employee.currentShopId,
        clusterId: employee.currentClusterId,
        role: employee.currentRole,
        level: employee.currentLevel,
        directManagerId: employee.directManagerId,
        evaluatorId: employee.currentEvaluatorId,
        startDate: effectiveDate,
        reason: `Transfer request ${transfer.id}`,
        approvedById: input.principal.id
      }
    });

    return tx.transferRequest.update({
      where: { id: transfer.id },
      data: { status: "COMPLETED", approvedById: input.principal.id },
      include: { employee: true }
    });
  });

  await writeAuditLog({
    userId: input.principal.id,
    action: "TRANSFER_COMPLETION",
    entityType: "TransferRequest",
    entityId: updated.id,
    newValue: updated
  });

  return updated;
}

export async function completePromotion(input: { principal: Principal; promotionId: string }) {
  const promotion = await prisma.promotionRequest.findUnique({ where: { id: input.promotionId }, include: { employee: true } });
  if (!promotion) throw new Error("Promotion request not found.");
  const effectiveDate = promotion.effectiveDate ?? new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employeeAssignment.updateMany({
      where: { employeeId: promotion.employeeId, endDate: null },
      data: { endDate: effectiveDate }
    });

    const employee = await tx.employee.update({
      where: { id: promotion.employeeId },
      data: {
        currentRole: promotion.proposedRole ?? promotion.employee.currentRole,
        currentLevel: promotion.proposedLevel ?? promotion.employee.currentLevel,
        ...(promotion.proposedSalary && canUpdateSalary(input.principal)
          ? {
              basicSalary: promotion.proposedSalary,
              salaryEffectiveDate: promotion.salaryEffectiveDate ?? effectiveDate
            }
          : {}),
        updatedById: input.principal.id
      }
    });

    await tx.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        divisionId: employee.currentDivisionId,
        departmentId: employee.currentDepartmentId,
        regionId: employee.currentRegionId,
        shopId: employee.currentShopId,
        clusterId: employee.currentClusterId,
        role: employee.currentRole,
        level: employee.currentLevel,
        directManagerId: employee.directManagerId,
        evaluatorId: employee.currentEvaluatorId,
        startDate: effectiveDate,
        reason: `Promotion request ${promotion.id}`,
        approvedById: input.principal.id
      }
    });

    if (promotion.proposedSalary && canUpdateSalary(input.principal)) {
      await tx.employeeSalary.create({
        data: {
          employeeId: employee.id,
          basicSalary: promotion.proposedSalary,
          effectiveDate: promotion.salaryEffectiveDate ?? effectiveDate,
          reason: `Promotion request ${promotion.id}`,
          approvedById: input.principal.id,
          createdById: input.principal.id
        }
      });
    }

    return tx.promotionRequest.update({
      where: { id: promotion.id },
      data: { status: "COMPLETED", approvedById: input.principal.id },
      include: { employee: true }
    });
  });

  await writeAuditLog({
    userId: input.principal.id,
    action: "PROMOTION_COMPLETION",
    entityType: "PromotionRequest",
    entityId: updated.id,
    newValue: redactPromotionSalary(updated, input.principal)
  });

  return updated;
}

export function normalizeOptionalEnum<T extends string>(value: unknown): T | undefined {
  const text = String(value ?? "").trim();
  return text ? (text as T) : undefined;
}

export function decimalFromForm(value: unknown): Prisma.Decimal | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? new Prisma.Decimal(numeric) : undefined;
}

export function redactPromotionSalary<T extends Pick<PromotionRequest, "proposedSalary">>(promotion: T, principal: Principal) {
  if (canUpdateSalary(principal)) return promotion;
  return { ...promotion, proposedSalary: null };
}

export function assignmentDate(value: unknown): Date | undefined {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : undefined;
}

export type TransferPayload = Pick<
  TransferRequest,
  "requestedDivisionId" | "requestedDepartmentId" | "requestedRegionId" | "requestedShopId" | "requestedClusterId" | "requestedManagerId"
> & {
  requestedRole?: EmployeeRole | null;
  requestedLevel?: EmployeeLevel | null;
};

export type TerminationWithEmployee = TerminationCase & {
  employee: {
    id: string;
    currentRole: EmployeeRole;
    currentDepartmentId: string | null;
    currentRegionId: string | null;
    currentShopId: string | null;
    currentClusterId: string | null;
    directManagerId: string | null;
  };
};
