import { ProfileChangeField } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission, requirePrincipal } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const requestSchema = z.object({
  requestedField: z.nativeEnum(ProfileChangeField),
  newValue: z.string().min(1),
  reason: z.string().optional().nullable()
});

export async function GET() {
  const principal = await requirePrincipal();
  if (isApiError(principal)) return principal;
  const canViewAll = hasPermission(principal, "profile_change_request.view");
  const canViewOwn = hasPermission(principal, "self_service.profile_update_request");
  if (!canViewAll && !canViewOwn) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

  const requests = await prisma.employeeProfileChangeRequest.findMany({
    where: canViewAll ? undefined : { employeeId: principal.employeeId ?? "__none__" },
    include: { employee: { select: { employeeId: true, fullName: true, currentRole: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const principal = await requirePermission("self_service.profile_update_request");
  if (isApiError(principal)) return principal;
  if (!principal.employeeId) return NextResponse.json({ error: "No employee profile is linked to your account." }, { status: 422 });

  const parsed = requestSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile change request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: principal.employeeId } });
  if (!employee) return NextResponse.json({ error: "Linked employee profile not found." }, { status: 404 });
  const oldValue = currentProfileValue(employee, parsed.data.requestedField);

  const profileRequest = await prisma.employeeProfileChangeRequest.create({
    data: {
      employeeId: employee.id,
      requestedField: parsed.data.requestedField,
      oldValue,
      newValue: parsed.data.newValue,
      reason: parsed.data.reason,
      requestedById: principal.id
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "PROFILE_CHANGE_REQUEST_CREATE",
    entityType: "EmployeeProfileChangeRequest",
    entityId: profileRequest.id,
    newValue: {
      requestedField: profileRequest.requestedField,
      status: profileRequest.status
    }
  });

  return NextResponse.json({ request: profileRequest }, { status: 201 });
}

function currentProfileValue(
  employee: { phoneNumber: string | null; address: string | null; email: string | null },
  field: ProfileChangeField
) {
  if (field === "PHONE_NUMBER") return employee.phoneNumber;
  if (field === "ADDRESS") return employee.address;
  if (field === "PERSONAL_EMAIL") return employee.email;
  return null;
}
