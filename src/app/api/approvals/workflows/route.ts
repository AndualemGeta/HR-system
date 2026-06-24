import { ApprovalWorkflowType, SystemRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateApprovalWorkflowActivation } from "@/lib/phase3-validation";
import { validateGovernanceSettings } from "@/lib/phase4-validation";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalSystemRole = z.preprocess(emptyToUndefined, z.nativeEnum(SystemRole).optional().nullable());
const optionalString = z.preprocess(emptyToUndefined, z.string().optional().nullable());
const optionalPositiveInt = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional().nullable());

const workflowSchema = z.object({
  name: z.string().min(1),
  workflowType: z.nativeEnum(ApprovalWorkflowType),
  activeStatus: z.coerce.boolean().default(true),
  stepOrder: z.coerce.number().int().min(1).default(1),
  approverRole: optionalSystemRole,
  approverUserId: optionalString,
  requiredPermission: optionalString,
  fallbackApproverRole: optionalSystemRole,
  fallbackApproverUserId: optionalString,
  escalationRole: optionalSystemRole,
  escalationAfterDays: optionalPositiveInt,
  preventSelfApproval: z.coerce.boolean().default(true),
  requireCommentsOnReject: z.coerce.boolean().default(true),
  requireCommentsOnChange: z.coerce.boolean().default(true)
});

const governanceSchema = z.object({
  stepId: z.string().min(1),
  fallbackApproverRole: optionalSystemRole,
  fallbackApproverUserId: optionalString,
  escalationRole: optionalSystemRole,
  escalationAfterDays: optionalPositiveInt,
  preventSelfApproval: z.coerce.boolean().default(true),
  requireCommentsOnReject: z.coerce.boolean().default(true),
  requireCommentsOnChange: z.coerce.boolean().default(true),
  activeStatus: z.coerce.boolean().default(true)
});

export async function GET() {
  const principal = await requirePermission("approval.view");
  if (isApiError(principal)) return principal;

  const workflows = await prisma.approvalWorkflow.findMany({
    include: { steps: { orderBy: { stepOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return NextResponse.json({ workflows });
}

export async function POST(request: Request) {
  const principal = await requirePermission("approval.configure");
  if (isApiError(principal)) return principal;

  const parsed = workflowSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval workflow.", details: parsed.error.flatten() }, { status: 400 });
  }
  const issues = validateApprovalWorkflowActivation({ activeStatus: parsed.data.activeStatus, activeStepCount: 1 });
  if (issues.length > 0) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const governanceIssues = validateGovernanceSettings({
    activeStatus: parsed.data.activeStatus,
    requiredStepCount: 1,
    escalationAfterDays: parsed.data.escalationAfterDays,
    fallbackConfigured: Boolean(parsed.data.fallbackApproverRole || parsed.data.fallbackApproverUserId || parsed.data.escalationRole)
  });
  if (governanceIssues.some((issue) => issue.severity === "BLOCKER")) {
    return NextResponse.json({ error: governanceIssues[0].message, issues: governanceIssues }, { status: 422 });
  }

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      name: parsed.data.name,
      workflowType: parsed.data.workflowType,
      activeStatus: parsed.data.activeStatus,
      createdById: principal.id,
      steps: {
        create: {
          stepOrder: parsed.data.stepOrder,
          approverRole: parsed.data.approverRole,
          approverUserId: parsed.data.approverUserId,
          requiredPermission: parsed.data.requiredPermission,
          fallbackApproverRole: parsed.data.fallbackApproverRole,
          fallbackApproverUserId: parsed.data.fallbackApproverUserId,
          escalationRole: parsed.data.escalationRole,
          escalationAfterDays: parsed.data.escalationAfterDays,
          preventSelfApproval: parsed.data.preventSelfApproval,
          requireCommentsOnReject: parsed.data.requireCommentsOnReject,
          requireCommentsOnChange: parsed.data.requireCommentsOnChange
        }
      }
    },
    include: { steps: true }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "APPROVAL_WORKFLOW_CHANGE",
    entityType: "ApprovalWorkflow",
    entityId: workflow.id,
    newValue: workflow
  });

  return NextResponse.json({ workflow }, { status: 201 });
}

export async function PATCH(request: Request) {
  const principal = await requirePermission("approval_governance.configure");
  if (isApiError(principal)) return principal;

  const parsed = governanceSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval governance settings.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.approvalStep.findUnique({
    where: { id: parsed.data.stepId },
    include: { workflow: { include: { steps: true } } }
  });
  if (!existing) return NextResponse.json({ error: "Approval step not found." }, { status: 404 });

  const governanceIssues = validateGovernanceSettings({
    activeStatus: parsed.data.activeStatus,
    requiredStepCount: existing.workflow.steps.filter((step) => step.isRequired && step.activeStatus).length,
    escalationAfterDays: parsed.data.escalationAfterDays,
    fallbackConfigured: Boolean(parsed.data.fallbackApproverRole || parsed.data.fallbackApproverUserId || parsed.data.escalationRole)
  });
  if (governanceIssues.some((issue) => issue.severity === "BLOCKER")) {
    return NextResponse.json({ error: governanceIssues[0].message, issues: governanceIssues }, { status: 422 });
  }

  const step = await prisma.approvalStep.update({
    where: { id: existing.id },
    data: {
      fallbackApproverRole: parsed.data.fallbackApproverRole,
      fallbackApproverUserId: parsed.data.fallbackApproverUserId,
      escalationRole: parsed.data.escalationRole,
      escalationAfterDays: parsed.data.escalationAfterDays,
      preventSelfApproval: parsed.data.preventSelfApproval,
      requireCommentsOnReject: parsed.data.requireCommentsOnReject,
      requireCommentsOnChange: parsed.data.requireCommentsOnChange,
      activeStatus: parsed.data.activeStatus
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "APPROVAL_GOVERNANCE_UPDATE",
    entityType: "ApprovalStep",
    entityId: step.id,
    oldValue: {
      fallbackApproverRole: existing.fallbackApproverRole,
      escalationRole: existing.escalationRole,
      escalationAfterDays: existing.escalationAfterDays
    },
    newValue: {
      fallbackApproverRole: step.fallbackApproverRole,
      escalationRole: step.escalationRole,
      escalationAfterDays: step.escalationAfterDays
    }
  });

  return NextResponse.json({ step });
}
