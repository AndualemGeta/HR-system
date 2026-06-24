import { EmploymentType, LeaveAccrualMethod, LeaveType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validateLeavePolicy } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  leaveType: z.nativeEnum(LeaveType),
  employmentType: z.nativeEnum(EmploymentType).optional().nullable(),
  annualEntitlementDays: z.coerce.number(),
  accrualMethod: z.nativeEnum(LeaveAccrualMethod),
  carryForwardAllowed: z.coerce.boolean().default(false),
  maxCarryForwardDays: z.coerce.number().optional().nullable(),
  activeStatus: z.coerce.boolean().default(true),
  effectiveStartDate: z.string().min(1),
  effectiveEndDate: z.string().optional().nullable()
});

export async function GET() {
  const principal = await requirePermission("leave_policy.view");
  if (isApiError(principal)) return principal;
  const policies = await prisma.leavePolicy.findMany({ orderBy: [{ activeStatus: "desc" }, { name: "asc" }], take: 200 });
  return NextResponse.json({ policies });
}

export async function POST(request: Request) {
  const principal = await requirePermission("leave_policy.manage");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid leave policy.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateLeavePolicy(parsed.data);
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const policy = await prisma.leavePolicy.create({
    data: {
      ...parsed.data,
      annualEntitlementDays: new Prisma.Decimal(parsed.data.annualEntitlementDays),
      maxCarryForwardDays: parsed.data.maxCarryForwardDays == null ? null : new Prisma.Decimal(parsed.data.maxCarryForwardDays),
      effectiveStartDate: new Date(parsed.data.effectiveStartDate),
      effectiveEndDate: parsed.data.effectiveEndDate ? new Date(parsed.data.effectiveEndDate) : null,
      createdById: principal.id
    }
  });
  await writeAuditLog({ userId: principal.id, action: "LEAVE_POLICY_CHANGE", entityType: "LeavePolicy", entityId: policy.id, newValue: policy });
  return NextResponse.json({ policy }, { status: 201 });
}
