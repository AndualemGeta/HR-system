import { AchievementType, ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canApproveAchievement, canCreateAchievementFor, employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    achievementId: string;
  }>;
};

const achievementPatchSchema = z.object({
  achievementType: z.nativeEnum(AchievementType).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  achievementDate: z.string().optional(),
  approvalStatus: z.nativeEnum(ApprovalStatus).optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("achievement.update");
  if (isApiError(principal)) return principal;

  const { achievementId } = await context.params;
  const existing = await prisma.achievement.findUnique({
    where: { id: achievementId },
    include: { employee: true }
  });
  if (!existing) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });

  const parsed = achievementPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid achievement update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const approvalStatus = parsed.data.approvalStatus;
  if (approvalStatus && ["APPROVED", "REJECTED"].includes(approvalStatus) && !canApproveAchievement(principal)) {
    return NextResponse.json({ error: "Permission denied for achievement approval." }, { status: 403 });
  }

  if (!hasPermission(principal, "achievement.approve") && !canCreateAchievementFor(principal, employeeToScope(existing.employee))) {
    return NextResponse.json({ error: "Achievement is outside your reporting scope." }, { status: 403 });
  }

  const updated = await prisma.achievement.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.achievementType ? { achievementType: parsed.data.achievementType } : {}),
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.achievementDate ? { achievementDate: new Date(parsed.data.achievementDate) } : {}),
      ...(approvalStatus
        ? {
            approvalStatus,
            approvedById: approvalStatus === "APPROVED" || approvalStatus === "REJECTED" ? principal.id : existing.approvedById
          }
        : {})
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action:
      approvalStatus === "APPROVED"
        ? "ACHIEVEMENT_APPROVAL"
        : approvalStatus === "REJECTED"
          ? "ACHIEVEMENT_REJECTION"
          : approvalStatus === "SUBMITTED"
            ? "ACHIEVEMENT_SUBMISSION"
            : "ACHIEVEMENT_UPDATE",
    entityType: "Achievement",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ achievement: updated });
}
