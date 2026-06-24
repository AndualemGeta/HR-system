"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavGroupsForPrincipal } from "@/components/layout/nav";
import type { Principal } from "@/lib/rbac";

export function Sidebar({ principal }: Readonly<{ principal: Principal }>) {
  const pathname = usePathname();
  const navGroups = getNavGroupsForPrincipal(principal);

  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>Leapfrog HRMS</strong>
        <span>Software Technology Africa PLC</span>
      </div>
      {navGroups.map((group) => (
        <details className="nav-section" key={group.label} open={(("defaultOpen" in group && group.defaultOpen) || group.items.some((item) => isActive(pathname, item.href)))}>
          <summary className="nav-section-label">{group.label}</summary>
          <nav aria-label={group.label}>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link className={`nav-link${active ? " active" : ""}`} href={item.href} key={item.href}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </details>
      ))}
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}
