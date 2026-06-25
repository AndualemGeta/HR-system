import type { ApprovalActionType, ApprovalWorkflowType, SystemRole } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { createNotification, notifyUsersWithRole } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { hasAnySystemRole, hasPermission, type Principal } from "@/lib/rbac";
import type { PermissionKey } from "@/lib/constants";

export async function ensureDefaultWorkflow(workflowType: ApprovalWorkflowType, createdById?: string | null) {
  const existing = await prisma.approvalWorkflow.findFirst({
    where: { workflowType, activeStatus: true },
    include: { steps: { where: { activeStatus: true }, orderBy: { stepOrder: "asc" } } }
  });
  if (existing) return existing;

  return prisma.approvalWorkflow.create({
    data: {
      name: `${workflowType.replace(/_/g, " ")} approval`,
      workflowType,
      createdById: createdById ?? null,
      steps: {
        create: {
          stepOrder: 1,
          approverRole: "HR_ADMIN",
          requiredPermission: requiredPermissionForWorkflow(workflowType)
        }
      }
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } }
  });
}

export async function submitApprovalRequest(input: {
  workflowType: ApprovalWorkflowType;
  entityType: string;
  entityId: string;
  requestedById?: string | null;
}) {
  const workflow = await ensureDefaultWorkflow(input.workflowType, input.requestedById);
  const request = await prisma.approvalRequest.create({
    data: {
      workflowId: workflow.id,
      entityType: input.entityType,
      entityId: input.entityId,
      requestedById: input.requestedById ?? null,
      actions: {
        create: {
          action: "SUBMIT",
          actionById: input.requestedById ?? null,
          stepId: workflow.steps[0]?.id
        }
      }
    },
    include: { workflow: { include: { steps: { where: { activeStatus: true }, orderBy: { stepOrder: "asc" } } } } }
  });

  const firstStep = request.workflow.steps[0];
  if (firstStep?.approverRole) {
    await notifyUsersWithRole({
      role: firstStep.approverRole,
      title: "Approval required",
      message: `${input.entityType} is waiting for approval.`,
      notificationType: "APPROVAL_REQUIRED",
      relatedEntityType: input.entityType,
      relatedEntityId: input.entityId
    });
  }

  return request;
}

export async function actOnApprovalRequest(input: {
  principal: Principal;
  approvalRequestId: string;
  action: ApprovalActionType;
  comments?: string | null;
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: input.approvalRequestId },
    include: {
      workflow: { include: { steps: { where: { activeStatus: true }, orderBy: { stepOrder: "asc" } } } }
    }
  });
  if (!request) throw new Error("Approval request not found.");

  const step = request.workflow.steps.find((candidate) => candidate.stepOrder === request.currentStep) ?? request.workflow.steps[0];
  if (!canActOnStep(input.principal, step)) {
    throw new Error("Permission denied for this approval step.");
  }

  const requiredSteps = request.workflow.steps.filter((candidate) => candidate.isRequired);
  const nextStep = input.action === "APPROVE" ? request.currentStep + 1 : request.currentStep;
  const finalApproved = input.action === "APPROVE" && nextStep > (requiredSteps.at(-1)?.stepOrder ?? 1);
  const nextStatus =
    input.action === "REJECT"
      ? "REJECTED"
      : input.action === "REQUEST_CHANGES"
        ? "CHANGES_REQUESTED"
        : input.action === "CANCEL"
          ? "CANCELLED"
          : finalApproved
            ? "APPROVED"
            : "IN_PROGRESS";

  const updated = await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: nextStatus,
      currentStep: finalApproved ? request.currentStep : nextStep,
      actions: {
        create: {
          stepId: step?.id,
          actionById: input.principal.id,
          action: input.action,
          comments: input.comments ?? null
        }
      }
    },
    include: { actions: { orderBy: { actionDate: "desc" } } }
  });

  await writeAuditLog({
    userId: input.principal.id,
    action: "APPROVAL_ACTION",
    entityType: "ApprovalRequest",
    entityId: updated.id,
    newValue: { action: input.action, status: updated.status }
  });

  if (request.requestedById && ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(nextStatus)) {
    await createNotification({
      recipientUserId: request.requestedById,
      title: "Approval updated",
      message: `${request.entityType} approval is now ${nextStatus}.`,
      notificationType:
        nextStatus === "APPROVED"
          ? "APPROVAL_COMPLETED"
          : nextStatus === "REJECTED"
            ? "REQUEST_REJECTED"
            : "REQUEST_CHANGES",
      relatedEntityType: request.entityType,
      relatedEntityId: request.entityId
    });
  }

  return updated;
}

function canActOnStep(principal: Principal, step?: { approverRole: SystemRole | null; approverUserId: string | null; requiredPermission: string | null }) {
  if (!step) return hasAnySystemRole(principal, ["SUPER_ADMIN", "HR_ADMIN"]);
  if (step.approverUserId && step.approverUserId !== principal.id) return false;
  if (step.approverRole && !hasAnySystemRole(principal, [step.approverRole])) return false;
  if (step.requiredPermission && !hasPermission(principal, step.requiredPermission as PermissionKey)) return false;
  return true;
}

function requiredPermissionForWorkflow(workflowType: ApprovalWorkflowType): string {
  const permissionByType: Record<ApprovalWorkflowType, string> = {
    DISCIPLINARY: "disciplinary.approve",
    TERMINATION: "termination.approve",
    TRANSFER: "transfer.approve",
    PROMOTION: "promotion.approve",
    LEAVE: "leave.approve",
    ACHIEVEMENT: "achievement.approve",
    EVALUATION: "evaluation.approve",
    IMPORT: "import.approve",
    OTHER: "approval.act"
  };
  return permissionByType[workflowType];
}
