import { EmployeeRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const criteriaSchema = z.object({
  name: z.string().min(1),
  description: z.preprocess((value) => (value === "" ? null : value), z.string().optional().nullable()),
  applicableRole: z.preprocess((value) => (value === "" ? null : value), z.nativeEnum(EmployeeRole).optional().nullable()),
  applicableDepartmentId: z.preprocess((value) => (value === "" ? null : value), z.string().optional().nullable()),
  weight: z.coerce.number().positive().default(1),
  maxScore: z.coerce.number().int().positive().default(100),
  activeStatus: z
    .preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())
    .default(true)
});

export async function GET() {
  const principal = await requirePermission("evaluation.view");
  if (isApiError(principal)) return principal;

  const criteria = await prisma.evaluationCriteria.findMany({
    include: { applicableDepartment: true },
    orderBy: [{ activeStatus: "desc" }, { name: "asc" }]
  });

  return NextResponse.json({ criteria });
}

export async function POST(request: Request) {
  const principal = await requirePermission("evaluation.configure");
  if (isApiError(principal)) return principal;

  const parsed = criteriaSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation criteria.", details: parsed.error.flatten() }, { status: 400 });
  }

  const criteria = await prisma.evaluationCriteria.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      applicableRole: parsed.data.applicableRole,
      applicableDepartmentId: parsed.data.applicableDepartmentId,
      weight: parsed.data.weight,
      maxScore: parsed.data.maxScore,
      activeStatus: parsed.data.activeStatus,
      createdById: principal.id
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "EVALUATION_CRITERIA_CHANGE",
    entityType: "EvaluationCriteria",
    entityId: criteria.id,
    newValue: criteria
  });

  return NextResponse.json({ criteria }, { status: 201 });
}

async function readRequestData(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? request.json()
    : Object.fromEntries((await request.formData()).entries());
}
