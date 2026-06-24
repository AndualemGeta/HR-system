import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/constants";
import { hasPermission, type Principal } from "@/lib/rbac";
import { getCurrentPrincipal } from "@/lib/security/session";

export async function requireAppUser(): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    redirect("/login");
  }

  return principal;
}

export async function requirePagePermission(permission: PermissionKey): Promise<Principal> {
  const principal = await requireAppUser();
  if (!hasPermission(principal, permission)) {
    redirect("/dashboard");
  }

  return principal;
}
