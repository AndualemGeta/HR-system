import { NextResponse } from "next/server";
import { hasPermission, type Principal } from "@/lib/rbac";
import type { PermissionKey } from "@/lib/constants";
import { getCurrentPrincipal } from "@/lib/security/session";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requirePrincipal(): Promise<Principal | NextResponse> {
  const principal = await getCurrentPrincipal();
  if (!principal) return jsonError("Authentication required.", 401);
  return principal;
}

export async function requirePermission(permission: PermissionKey): Promise<Principal | NextResponse> {
  const principal = await getCurrentPrincipal();
  if (!principal) return jsonError("Authentication required.", 401);
  if (!hasPermission(principal, permission)) return jsonError("Permission denied.", 403);
  return principal;
}

export function isApiError(value: Principal | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

