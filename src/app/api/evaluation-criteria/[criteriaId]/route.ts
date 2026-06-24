import { EmployeeRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    criteriaId: string;
  }>;
};

const criteriaPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  applicableRole: z.nativeEnum(EmployeeRole).nullable().optional(),
  applicableDepartmentId: z.string().nullable().optional(),
  weight: z.coerce.number().positive().optional(),
  maxScore: z.coerce.number().int().positive().optional(),
  activeStatus: z.boolean().optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("evaluation.configure");
  if (isApiError(principal)) return principal;

  const { criteriaId } = await context.params;
  const existing = await prisma.evaluationCriteria.findUnique({ where: { id: criteriaId } });
  if (!existing) return NextResponse.json({ error: "Evaluation criteria not found." }, { status: 404 });

  const parsed = criteriaPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation criteria update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.evaluationCriteria.update({
    where: { id: existing.id },
    data: parsed.data
  });

  await writeAuditLog({
    userId: principal.id,
    action: "EVALUATION_CRITERIA_CHANGE",
    entityType: "EvaluationCriteria",
    entityId: updated.id,
    oldValue: existing,
    newValue: updated
  });

  return NextResponse.json({ criteria: updated });
}
