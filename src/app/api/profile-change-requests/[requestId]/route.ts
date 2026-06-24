import { ProfileChangeRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().optional().nullable()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("profile_change_request.approve");
  if (isApiError(principal)) return principal;

  const { requestId } = await context.params;
  const parsed = reviewSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile change review.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.employeeProfileChangeRequest.findUnique({ where: { id: requestId } });
  if (!existing) return NextResponse.json({ error: "Profile change request not found." }, { status: 404 });
  if (existing.status !== "SUBMITTED") return NextResponse.json({ error: "Only submitted requests can be reviewed." }, { status: 422 });

  if (parsed.data.status === "APPROVED") {
    await applyProfileChange(existing.employeeId, existing.requestedField, existing.newValue);
  }

  const reviewed = await prisma.employeeProfileChangeRequest.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status as ProfileChangeRequestStatus,
      reviewedById: principal.id,
      approvedById: parsed.data.status === "APPROVED" ? principal.id : null,
      reason: parsed.data.reason ?? existing.reason
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.status === "APPROVED" ? "PROFILE_CHANGE_REQUEST_APPROVAL" : "PROFILE_CHANGE_REQUEST_REJECTION",
    entityType: "EmployeeProfileChangeRequest",
    entityId: reviewed.id,
    oldValue: { status: existing.status },
    newValue: { status: reviewed.status, requestedField: reviewed.requestedField }
  });

  return NextResponse.json({ request: reviewed });
}

async function applyProfileChange(employeeId: string, field: string, value: string) {
  if (field === "PHONE_NUMBER") {
    await prisma.employee.update({ where: { id: employeeId }, data: { phoneNumber: value } });
  } else if (field === "ADDRESS") {
    await prisma.employee.update({ where: { id: employeeId }, data: { address: value } });
  } else if (field === "PERSONAL_EMAIL") {
    await prisma.employee.update({ where: { id: employeeId }, data: { email: value } });
  }
}
