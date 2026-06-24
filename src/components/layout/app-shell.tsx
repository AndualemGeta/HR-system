import { Bell, CircleUserRound, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <header className="topbar">
          <h1>HR Management System</h1>
          <div className="topbar-actions">
            <Link className="button secondary topbar-button" href="/employees/new">
              <Plus size={16} aria-hidden="true" />
              Employee
            </Link>
            <Link className="button secondary topbar-button" href="/data-quality">
              <ShieldAlert size={16} aria-hidden="true" />
              Issues
            </Link>
            <Link className="icon-button" href="/notifications" title="Notifications">
              <Bell size={17} aria-hidden="true" />
            </Link>
            <Link className="icon-button" href="/self-service" title="Self Service">
              <CircleUserRound size={17} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
