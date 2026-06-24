import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { Principal } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { SystemRoleValue } from "@/lib/constants";

export const sessionCookieName = "lsta_session";

type SessionPayload = {
  sub: string;
  email: string;
};

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(authSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, authSecret());
    return {
      sub: verified.payload.sub ?? "",
      email: String(verified.payload.email ?? "")
    };
  } catch {
    return null;
  }
}

export async function getCurrentPrincipal(): Promise<Principal | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      employee: {
        include: {
          directReports: {
            select: {
              id: true
            }
          }
        }
      },
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user || user.status !== "ACTIVE") return null;

  const employee = user.employee;
  return {
    id: user.id,
    employeeId: employee?.id,
    employeeRole: employee?.currentRole,
    systemRoles: user.roles.map((userRole) => userRole.role.name as SystemRoleValue),
    departmentIds: employee?.currentDepartmentId ? [employee.currentDepartmentId] : [],
    regionIds: employee?.currentRegionId ? [employee.currentRegionId] : [],
    shopIds: employee?.currentShopId ? [employee.currentShopId] : [],
    clusterIds: employee?.currentClusterId ? [employee.currentClusterId] : [],
    directReportIds: employee?.directReports.map((report) => report.id) ?? []
  };
}
