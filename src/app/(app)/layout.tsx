import { AppShell } from "@/components/layout/app-shell";
import { requireAppUser } from "@/lib/security/page-auth";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const principal = await requireAppUser();

  return <AppShell principal={principal}>{children}</AppShell>;
}
