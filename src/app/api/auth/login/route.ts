import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/security/password";
import { createSessionToken, sessionCookieName } from "@/lib/security/session";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    await writeAuditLog({
      action: "FAILED_LOGIN",
      entityType: "User",
      entityId: email,
      ipAddress: request.headers.get("x-forwarded-for"),
      newValue: { reason: "inactive_or_missing_user" }
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await writeAuditLog({
      userId: user.id,
      action: "FAILED_LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      newValue: { reason: "locked_user" }
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= Number(process.env.FAILED_LOGIN_LOCKOUT_THRESHOLD ?? 5)
          ? new Date(Date.now() + Number(process.env.FAILED_LOGIN_LOCKOUT_MINUTES ?? 15) * 60_000)
          : null
      }
    });
    await writeAuditLog({
      userId: user.id,
      action: "FAILED_LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      newValue: { failedLoginCount }
    });
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createSessionToken({ sub: user.id, email: user.email });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null }
  });
  await writeAuditLog({
    userId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    ipAddress: request.headers.get("x-forwarded-for")
  });

  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
