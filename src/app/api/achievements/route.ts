import { AchievementType, ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canCreateAchievementFor, canViewScopedEmployee, employeeToScope } from "@/lib/phase2-access";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const achievementSchema = z.object({
  employeeId: z.string().min(1),
  achievementType: z.nativeEnum(AchievementType),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  achievementDate: z.string().min(1),
  divisionId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  shopId: z.string().optional().nullable(),
  approvalStatus: z.nativeEnum(ApprovalStatus).default("DRAFT")
});

export async function GET() {
  const principal = await requirePermission("achievement.view");
  if (isApiError(principal)) return principal;

  const achievements = await prisma.achievement.findMany({
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          currentRole: true,
          currentDepartmentId: true,
          currentRegionId: true,
          currentShopId: true,
          currentClusterId: true,
          directManagerId: true
        }
      },
      department: true,
      region: true,
      shop: true
    },
    orderBy: { achievementDate: "desc" },
    take: 100
  });

  return NextResponse.json({
    achievements: achievements.filter((achievement) =>
      achievement.approvalStatus === "APPROVED"
        ? canViewScopedEmployee(principal, employeeToScope(achievement.employee))
        : canCreateAchievementFor(principal, employeeToScope(achievement.employee))
    )
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("achievement.create");
  if (isApiError(principal)) return principal;

  const parsed = achievementSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid achievement.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!canCreateAchievementFor(principal, employeeToScope(employee))) {
    return NextResponse.json({ error: "Employee is outside achievement creation scope." }, { status: 403 });
  }

  const achievement = await prisma.achievement.create({
    data: {
      employeeId: employee.id,
      achievementType: parsed.data.achievementType,
      title: parsed.data.title,
      description: parsed.data.description,
      achievementDate: new Date(parsed.data.achievementDate),
      divisionId: parsed.data.divisionId,
      departmentId: parsed.data.departmentId,
      regionId: parsed.data.regionId,
      shopId: parsed.data.shopId,
      createdById: principal.id,
      approvalStatus: parsed.data.approvalStatus
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: achievement.approvalStatus === "SUBMITTED" ? "ACHIEVEMENT_SUBMISSION" : "ACHIEVEMENT_CREATE",
    entityType: "Achievement",
    entityId: achievement.id,
    newValue: achievement
  });

  return NextResponse.json({ achievement }, { status: 201 });
}

async function readRequestData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}
