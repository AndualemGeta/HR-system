import { SystemRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { hashPassword, validatePasswordPolicy } from "@/lib/security/password";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(10),
  roles: z.array(z.string()).min(1)
});

export async function GET() {
  const principal = await requirePermission("user.manage");
  if (isApiError(principal)) return principal;

  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true
        }
      },
      employee: { select: { id: true, employeeId: true, fullName: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const principal = await requirePermission("user.manage");
  if (isApiError(principal)) return principal;

  const payload = userSchema.parse(await request.json());
  const passwordIssues = validatePasswordPolicy(payload.password);
  if (passwordIssues.length > 0) {
    return NextResponse.json({ error: "Password does not meet policy.", issues: passwordIssues }, { status: 422 });
  }
  const passwordHash = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      email: payload.email.toLowerCase(),
      name: payload.name,
      passwordHash,
      roles: {
        create: payload.roles.map((roleName) => ({
          role: {
            connect: {
              name: roleName as SystemRole
            }
          }
        }))
      }
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "USER_PERMISSION_CHANGE",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, roles: payload.roles }
  });

  return NextResponse.json({ user }, { status: 201 });
}
