import {
  Award,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  Building2,
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
  Network,
  ShieldCheck,
  ShieldAlert,
  Star,
  Activity,
  LockKeyhole,
  Mail,
  TrendingUp,
  UserCheck,
  Users,
  UserRoundCog
} from "lucide-react";

export const navGroups = [
  {
    label: "Start Here",
    defaultOpen: true,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/employees", label: "Employee List", icon: Users },
      { href: "/employees/new", label: "Create Employee", icon: UserRoundCog },
      { href: "/self-service", label: "Self Service", icon: CircleUserRound },
      { href: "/manager-dashboard", label: "Manager Tools", icon: Users }
    ]
  },
  {
    label: "People Setup",
    defaultOpen: true,
    items: [
      { href: "/organization", label: "Organization Structure", icon: Network },
      { href: "/departments", label: "Departments", icon: Building2 },
      { href: "/assignments", label: "Assignments", icon: GitBranch },
      { href: "/onboarding", label: "Onboarding", icon: ListChecks },
      { href: "/documents", label: "Documents", icon: FileArchive },
      { href: "/required-document-rules", label: "Document Rules", icon: ShieldCheck }
    ]
  },
  {
    label: "HR Workflows",
    items: [
      { href: "/leave", label: "Leave Records", icon: BriefcaseBusiness },
      { href: "/leave-policies", label: "Leave Policies", icon: BriefcaseBusiness },
      { href: "/leave-balances", label: "Leave Balances", icon: BriefcaseBusiness },
      { href: "/achievements", label: "Achievements", icon: Award },
      { href: "/evaluations", label: "Evaluations", icon: ClipboardCheck },
      { href: "/evaluation-criteria", label: "Criteria Setup", icon: Star },
      { href: "/disciplinary", label: "Disciplinary", icon: ShieldAlert },
      { href: "/termination", label: "Termination & Exit", icon: ClipboardList },
      { href: "/transfers", label: "Transfers", icon: GitBranch },
      { href: "/promotions", label: "Promotions", icon: TrendingUp },
      { href: "/approvals", label: "Approvals", icon: UserCheck }
    ]
  },
  {
    label: "Attendance & Payroll",
    items: [
      { href: "/attendance-records", label: "Attendance", icon: ListChecks },
      { href: "/attendance-import", label: "Attendance Import", icon: FileSpreadsheet },
      { href: "/payroll-preparation", label: "Payroll Prep", icon: BadgeDollarSign },
      { href: "/payroll-validation", label: "Payroll Warnings", icon: ShieldAlert },
      { href: "/compensation-dashboard", label: "Compensation", icon: BadgeDollarSign },
      { href: "/salary", label: "Salary History", icon: BadgeDollarSign },
      { href: "/salary-reviews", label: "Salary Reviews", icon: TrendingUp },
      { href: "/commission-plans", label: "Commission Plans", icon: ClipboardList },
      { href: "/commission-calculations", label: "Commission Calc", icon: FileSpreadsheet },
      { href: "/payroll-adjustments", label: "Adjustments", icon: BadgeDollarSign },
      { href: "/payroll-period-locks", label: "Payroll Locks", icon: LockKeyhole },
      { href: "/payroll-export-templates", label: "Export Templates", icon: FileCog },
      { href: "/export-history", label: "Export History", icon: History }
    ]
  },
  {
    label: "Payroll Setup",
    items: [
      { href: "/payroll-rules", label: "Payroll Rules", icon: UserRoundCog },
      { href: "/paye-tax-brackets", label: "PAYE Brackets", icon: ShieldCheck },
      { href: "/pension-rules", label: "Pension Rules", icon: ShieldCheck },
      { href: "/payroll-attendance", label: "Attendance Inputs", icon: ListChecks },
      { href: "/payroll-allowances", label: "Allowances", icon: Award },
      { href: "/payroll-deductions", label: "Deductions", icon: ShieldAlert }
    ]
  },
  {
    label: "Performance",
    items: [
      { href: "/kpi", label: "KPI Foundation", icon: ClipboardCheck },
      { href: "/kpi-import-templates", label: "KPI Templates", icon: ClipboardCheck },
      { href: "/kpi-evaluation-linkage", label: "KPI Linkage", icon: TrendingUp },
      { href: "/team-attendance", label: "Team Attendance", icon: Users },
      { href: "/team-leave", label: "Team Leave", icon: Users }
    ]
  },
  {
    label: "Oversight",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/reports/advanced", label: "Advanced Reports", icon: BarChart3 },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/data-quality", label: "Data Quality", icon: ShieldAlert },
      { href: "/reminders", label: "HR Reminders", icon: ListChecks },
      { href: "/imports", label: "HR File Import", icon: FileSpreadsheet },
      { href: "/imports/preview", label: "Validation Preview", icon: ShieldCheck }
    ]
  },
  {
    label: "Admin & Security",
    items: [
      { href: "/notifications", label: "Notifications", icon: Inbox },
      { href: "/notification-preferences", label: "Notification Prefs", icon: Inbox },
      { href: "/profile-change-requests", label: "Profile Requests", icon: CircleUserRound },
      { href: "/email-templates", label: "Email Templates", icon: Mail },
      { href: "/email-delivery-logs", label: "Email Logs", icon: Mail },
      { href: "/security-settings", label: "Security Settings", icon: ShieldCheck },
      { href: "/security-reports", label: "Security Reports", icon: ShieldCheck },
      { href: "/data-retention-policies", label: "Retention", icon: FileArchive },
      { href: "/integration-tokens", label: "Integration Tokens", icon: LockKeyhole },
      { href: "/integration-event-logs", label: "Integration Events", icon: Activity },
      { href: "/production-readiness", label: "Production Checklist", icon: ClipboardList },
      { href: "/system-health", label: "System Health", icon: Activity },
      { href: "/api-documentation", label: "API Documentation", icon: FileCog },
      { href: "/system-settings", label: "System Settings", icon: UserRoundCog },
      { href: "/users", label: "Users & Roles", icon: UserRoundCog },
      { href: "/audit", label: "Audit Logs", icon: History }
    ]
  }
] as const;
