import {
  Award,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardList,
  CircleUserRound,
  FileArchive,
  FileCog,
  FileSpreadsheet,
  GitBranch,
  Inbox,
  History,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  ShieldAlert,
  Activity,
  LockKeyhole,
  Mail,
  TrendingUp,
  Users,
  UserRoundCog
} from "lucide-react";
import type { PermissionKey, SystemRoleValue } from "../../lib/constants";
import { hasAnySystemRole, hasPermission, type Principal } from "../../lib/rbac";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  anyPermissions?: readonly PermissionKey[];
  roles?: readonly SystemRoleValue[];
};

type NavGroup = {
  label: string;
  defaultOpen?: boolean;
  roles?: readonly SystemRoleValue[];
  anyPermissions?: readonly PermissionKey[];
  items: readonly NavItem[];
};

const employeeRoles = ["EMPLOYEE"] as const;
const managerRoles = [
  "SHOP_MANAGER",
  "AREA_SALES_MANAGER",
  "SALES_HEAD",
  "DISTRIBUTION_MANAGER",
  "DISTRIBUTION_OFFICER",
  "TECHNOLOGY_MANAGER",
  "TREASURY_MANAGER",
  "FINANCIAL_CONTROL_REPORTING_MANAGER",
  "SUPER_ADMIN"
] as const;
const hrRoles = ["HR_ADMIN", "HR_MANAGER", "HR_OFFICER", "SUPER_ADMIN"] as const;
const financeRoles = ["FINANCE_DIRECTOR", "FINANCE_PAYROLL", "SUPER_ADMIN"] as const;
const adminAuditRoles = ["SUPER_ADMIN", "HR_ADMIN", "AUDITOR"] as const;

export const navGroups = [
  {
    label: "Employee",
    defaultOpen: true,
    roles: employeeRoles,
    items: [
      { href: "/self-service", label: "Self Service", icon: CircleUserRound, anyPermissions: ["self_service.view"] },
      { href: "/self-service", label: "Request Leave", icon: BriefcaseBusiness, anyPermissions: ["self_service.leave_request"] },
      { href: "/documents", label: "My Documents", icon: FileArchive, anyPermissions: ["document.view"] },
      { href: "/leave", label: "My Leave", icon: BriefcaseBusiness, anyPermissions: ["leave.view"] },
      { href: "/evaluations", label: "My Evaluations", icon: ClipboardCheck, anyPermissions: ["evaluation.view"] },
      { href: "/notifications", label: "Notifications", icon: Inbox, anyPermissions: ["notification.view"] }
    ]
  },
  {
    label: "Shop Manager / Area Manager",
    defaultOpen: true,
    roles: managerRoles,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, anyPermissions: ["employee.view"] },
      { href: "/manager-dashboard", label: "Manager Tools", icon: Users, anyPermissions: ["manager_dashboard.view"] },
      { href: "/team-attendance", label: "Team Attendance", icon: ListChecks, anyPermissions: ["team_attendance.view"] },
      { href: "/team-leave", label: "Team Leave", icon: BriefcaseBusiness, anyPermissions: ["team_leave.view"] },
      { href: "/evaluations", label: "Evaluations", icon: ClipboardCheck, anyPermissions: ["evaluation.view"] },
      { href: "/achievements", label: "Achievements", icon: Award, anyPermissions: ["achievement.view"] },
      { href: "/notifications", label: "Notifications", icon: Inbox, anyPermissions: ["notification.view"] }
    ]
  },
  {
    label: "HR",
    roles: hrRoles,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, anyPermissions: ["employee.view"] },
      { href: "/employees", label: "Employees", icon: Users, anyPermissions: ["employee.view"] },
      { href: "/employees/new", label: "Create Employee", icon: UserRoundCog, anyPermissions: ["employee.create"] },
      { href: "/org-chart", label: "Org Chart", icon: GitBranch, anyPermissions: ["employee.view"] },
      { href: "/contract-renewals", label: "Contract Renewals", icon: FileCog, anyPermissions: ["employee.view"] },
      { href: "/onboarding", label: "Onboarding", icon: ListChecks, anyPermissions: ["onboarding.view"] },
      { href: "/documents", label: "Documents", icon: FileArchive, anyPermissions: ["document.view"] },
      { href: "/leave", label: "Leave", icon: BriefcaseBusiness, anyPermissions: ["leave.view"] },
      { href: "/evaluations", label: "Evaluations", icon: ClipboardCheck, anyPermissions: ["evaluation.view"] },
      { href: "/salary-reviews", label: "Salary Reviews", icon: TrendingUp, anyPermissions: ["salary_review.view"] },
      { href: "/disciplinary", label: "Disciplinary", icon: ShieldAlert, anyPermissions: ["disciplinary.view"] },
      { href: "/termination", label: "Termination", icon: ClipboardList, anyPermissions: ["termination.view"] },
      { href: "/reports", label: "Reports", icon: BarChart3, anyPermissions: ["reports.view"] },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, anyPermissions: ["compliance.view"] },
      { href: "/data-quality", label: "Data Quality", icon: ShieldAlert, anyPermissions: ["data_quality.view"] }
    ]
  },
  {
    label: "Finance / Payroll",
    roles: financeRoles,
    items: [
      { href: "/payroll-preparation", label: "Payroll Preparation", icon: BadgeDollarSign, anyPermissions: ["payroll_preparation.view"] },
      { href: "/salary-reviews", label: "Salary Reviews", icon: TrendingUp, anyPermissions: ["salary_review.view"] },
      { href: "/commission-calculations", label: "Commission", icon: FileSpreadsheet, anyPermissions: ["commission_calculation.view"] },
      { href: "/payroll-rules", label: "Payroll Rules", icon: UserRoundCog, anyPermissions: ["payroll_rule.view"] },
      { href: "/paye-tax-brackets", label: "PAYE", icon: ShieldCheck, anyPermissions: ["paye_tax.view"] },
      { href: "/pension-rules", label: "Pension", icon: ShieldCheck, anyPermissions: ["pension_rule.view"] },
      { href: "/payroll-export-templates", label: "Payroll Export", icon: FileCog, anyPermissions: ["payroll_export_template.view"] },
      { href: "/reports", label: "Payroll Reports", icon: BarChart3, anyPermissions: ["reports.view"] }
    ]
  },
  {
    label: "Admin / Auditor",
    roles: adminAuditRoles,
    items: [
      { href: "/users", label: "Users and Roles", icon: UserRoundCog, anyPermissions: ["user.manage", "role.manage"] },
      { href: "/audit", label: "Audit Logs", icon: History, anyPermissions: ["audit.view"] },
      { href: "/security-reports", label: "Security Reports", icon: ShieldCheck, anyPermissions: ["security_reports.view"] },
      { href: "/system-settings", label: "System Settings", icon: UserRoundCog, anyPermissions: ["system_settings.view"] },
      { href: "/security-settings", label: "Security Settings", icon: ShieldCheck, anyPermissions: ["security_settings.view", "security_settings.manage"] },
      { href: "/integration-tokens", label: "Integration Tokens", icon: LockKeyhole, anyPermissions: ["integration_token.view", "integration_token.manage"] },
      { href: "/data-retention-policies", label: "Retention", icon: FileArchive, anyPermissions: ["data_retention.view"] },
      { href: "/export-history", label: "Export History", icon: History, anyPermissions: ["export_history.view"] }
    ]
  },
  {
    label: "Review Setup",
    items: [
      { href: "/attendance-records", label: "Attendance Foundation", icon: ListChecks, anyPermissions: ["attendance.view"], roles: hrRoles },
      { href: "/attendance-import", label: "Attendance Import Preview", icon: FileSpreadsheet, anyPermissions: ["attendance.import"], roles: hrRoles },
      { href: "/leave-policies", label: "Leave Policy Setup", icon: BriefcaseBusiness, anyPermissions: ["leave_policy.view"], roles: hrRoles },
      { href: "/leave-balances", label: "Leave Balances", icon: BriefcaseBusiness, anyPermissions: ["leave_balance.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/payroll-attendance", label: "Payroll Attendance Inputs", icon: ListChecks, anyPermissions: ["payroll_attendance.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/payroll-allowances", label: "Payroll Allowances", icon: Award, anyPermissions: ["payroll_allowance.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/payroll-deductions", label: "Payroll Deductions", icon: ShieldAlert, anyPermissions: ["payroll_deduction.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/payroll-adjustments", label: "Payroll Adjustments", icon: BadgeDollarSign, anyPermissions: ["payroll_adjustment.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/payroll-period-locks", label: "Payroll Locks", icon: LockKeyhole, anyPermissions: ["payroll_lock.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/commission-plans", label: "Commission Plans", icon: ClipboardList, anyPermissions: ["commission_plan.view"], roles: [...hrRoles, ...financeRoles] },
      { href: "/kpi", label: "KPI Foundation", icon: ClipboardCheck, anyPermissions: ["kpi.view"], roles: hrRoles },
      { href: "/kpi-import-templates", label: "KPI Templates", icon: ClipboardCheck, anyPermissions: ["kpi_import_template.view"], roles: hrRoles },
      { href: "/kpi-evaluation-linkage", label: "KPI Linkage", icon: TrendingUp, anyPermissions: ["kpi_evaluation_linkage.manage"], roles: hrRoles },
      { href: "/imports", label: "HR File Import", icon: FileSpreadsheet, anyPermissions: ["import.view"], roles: hrRoles },
      { href: "/reminders", label: "HR Reminders", icon: ListChecks, anyPermissions: ["reminder.view"], roles: hrRoles },
      { href: "/email-templates", label: "Email Templates", icon: Mail, anyPermissions: ["email_template.view"], roles: adminAuditRoles },
      { href: "/email-delivery-logs", label: "Email Logs", icon: Mail, anyPermissions: ["email_log.view"], roles: adminAuditRoles },
      { href: "/integration-event-logs", label: "Integration Events", icon: Activity, anyPermissions: ["integration_event.view"], roles: adminAuditRoles },
      { href: "/production-readiness", label: "Production Checklist", icon: ClipboardList, anyPermissions: ["production_readiness.view"], roles: adminAuditRoles },
      { href: "/system-health", label: "System Health", icon: Activity, anyPermissions: ["system_health.view"], roles: adminAuditRoles },
      { href: "/api-documentation", label: "API Documentation", icon: FileCog, anyPermissions: ["production_readiness.view"], roles: adminAuditRoles }
    ]
  }
] as const satisfies readonly NavGroup[];

export function getNavGroupsForPrincipal(principal: Principal): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canShowNavItem(principal, item))
    }))
    .filter((group) => group.items.length > 0 && canShowNavGroup(principal, group));
}

function canShowNavGroup(principal: Principal, group: NavGroup): boolean {
  return matchesRoles(principal, group.roles) && matchesAnyPermission(principal, group.anyPermissions);
}

function canShowNavItem(principal: Principal, item: NavItem): boolean {
  return matchesRoles(principal, item.roles) && matchesAnyPermission(principal, item.anyPermissions);
}

function matchesRoles(principal: Principal, roles?: readonly SystemRoleValue[]): boolean {
  return !roles || hasAnySystemRole(principal, [...roles]);
}

function matchesAnyPermission(principal: Principal, permissions?: readonly PermissionKey[]): boolean {
  return !permissions || permissions.some((permission) => hasPermission(principal, permission));
}
