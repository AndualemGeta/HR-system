import { Bell, CircleUserRound, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { hasPermission, type Principal } from "@/lib/rbac";

export function AppShell({ children, principal }: Readonly<{ children: React.ReactNode; principal: Principal }>) {
  return (
    <div className="app-shell">
      <Sidebar principal={principal} />
      <main className="main-area">
        <header className="topbar">
          <h1>HR Management System</h1>
          <div className="topbar-actions">
            {hasPermission(principal, "employee.create") && (
              <Link className="button secondary topbar-button" href="/employees/new">
                <Plus size={16} aria-hidden="true" />
                Employee
              </Link>
            )}
            {hasPermission(principal, "data_quality.view") && (
              <Link className="button secondary topbar-button" href="/data-quality">
                <ShieldAlert size={16} aria-hidden="true" />
                Issues
              </Link>
            )}
            {hasPermission(principal, "notification.view") && (
              <Link className="icon-button" href="/notifications" title="Notifications">
                <Bell size={17} aria-hidden="true" />
              </Link>
            )}
            {hasPermission(principal, "self_service.view") && (
              <Link className="icon-button" href="/self-service" title="Self Service">
                <CircleUserRound size={17} aria-hidden="true" />
              </Link>
            )}
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
