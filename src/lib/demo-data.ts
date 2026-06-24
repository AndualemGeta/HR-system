import type { ModuleItem, ModuleMetric } from "@/components/ui/module-page";

export const dashboardStats = [
  { label: "Active employees", value: 286, meta: "Across field and head office" },
  { label: "Onboarding pending", value: 14, meta: "Checklist or approval open" },
  { label: "Pending evaluations", value: 37, meta: "Submitted, reviewed, or overdue" },
  { label: "Import review rows", value: 42, meta: "Warnings and blockers awaiting HR" }
];

export const employees = [
  {
    id: "1",
    employeeId: "LSTA_0001",
    name: "Selam Tadesse",
    role: "HR_MANAGER",
    department: "Human Resources",
    location: "Head Office",
    manager: "CEO",
    status: "ACTIVE"
  },
  {
    id: "2",
    employeeId: "LSTA_0002",
    name: "Dawit Alemu",
    role: "SALES_HEAD",
    department: "Sales",
    location: "Addis Ababa",
    manager: "CEO",
    status: "ACTIVE"
  },
  {
    id: "3",
    employeeId: "LSTA_0003",
    name: "Mekdes Bekele",
    role: "SHOP_MANAGER",
    department: "Field Sales",
    location: "Bole Shop",
    manager: "Dawit Alemu",
    status: "ON_PROBATION"
  },
  {
    id: "4",
    employeeId: "LSTA_0004",
    name: "Yonatan Tesfaye",
    role: "DSA",
    department: "Field Sales",
    location: "Bole Cluster A",
    manager: "Mekdes Bekele",
    status: "ONBOARDING"
  }
];

export const validationRows = [
  {
    id: "vr1",
    employeeId: "LSTA_0145",
    name: "Imported row 18",
    issue: "Missing manager",
    severity: "BLOCKER",
    status: "Blocked"
  },
  {
    id: "vr2",
    employeeId: "LSTA_0146",
    name: "Imported row 19",
    issue: "Role source value needs review",
    severity: "REVIEW",
    status: "Review required"
  },
  {
    id: "vr3",
    employeeId: "LSTA_0147",
    name: "Imported row 20",
    issue: "Possible duplicate contact",
    severity: "WARNING",
    status: "Warning"
  }
];

export const orgTimeline = [
  ["CEO", "CEO Coordinator, Sales Head, Finance Director, HR Manager, Technology Manager"],
  ["Sales Head", "Area Sales Managers and shop operations"],
  ["Area Sales Manager", "Shop Managers, shop accountants, clusters"],
  ["Shop Manager", "DSA, DSP, BA Coordinator, cleaning and security staff"]
];

export const reportCards = [
  ["Employees by role", "Role distribution across field and head office"],
  ["Missing data", "Records missing employment type, manager, evaluator, salary, or location"],
  ["Probation ending soon", "Employees requiring probation evaluation and status decision"],
  ["Import validation history", "Clean, warning, review, and blocked rows by batch"]
];

type ScreenConfig = {
  title: string;
  description: string;
  metrics: ModuleMetric[];
  items: ModuleItem[];
};

const lifecycleItems: ModuleItem[] = [
  {
    id: "a",
    primary: "LSTA_0004 - Yonatan Tesfaye",
    secondary: "Bole Shop / Cluster A",
    status: "Review required",
    owner: "Mekdes Bekele",
    updated: "Today"
  },
  {
    id: "b",
    primary: "LSTA_0003 - Mekdes Bekele",
    secondary: "Field Sales / Bole",
    status: "Pending approval",
    owner: "Selam Tadesse",
    updated: "Yesterday"
  },
  {
    id: "c",
    primary: "LSTA_0002 - Dawit Alemu",
    secondary: "Sales / Addis Ababa",
    status: "Approved",
    owner: "CEO",
    updated: "Jun 17"
  }
];

export const screenConfigs: Record<string, ScreenConfig> = {
  organization: {
    title: "Organization Structure",
    description: "Configurable hierarchy for executive, head office, sales, distribution, finance, HR, and technology reporting lines.",
    metrics: [
      { label: "Configured units", value: "18" },
      { label: "Open manager slots", value: "3" },
      { label: "Future-ready nodes", value: "Enabled" }
    ],
    items: [
      { id: "ceo", primary: "CEO", secondary: "Executive Office", status: "Configured", owner: "Super Admin", updated: "Seed" },
      { id: "sales", primary: "Sales Head", secondary: "Field Sales", status: "Configured", owner: "HR Admin", updated: "Seed" },
      { id: "finance", primary: "Finance Director", secondary: "Finance", status: "Configured", owner: "HR Admin", updated: "Seed" }
    ]
  },
  departments: {
    title: "Department Management",
    description: "Head Office departments and nested reporting units with assignable heads and active status control.",
    metrics: [
      { label: "Departments", value: "7" },
      { label: "Head Office roles", value: "11" },
      { label: "Unassigned heads", value: "1" }
    ],
    items: lifecycleItems
  },
  assignments: {
    title: "Employee Assignment History",
    description: "Role, department, location, manager, evaluator, and active assignment controls with historical records preserved.",
    metrics: [
      { label: "Active assignments", value: "286" },
      { label: "Transfer requests", value: "5" },
      { label: "Multiple active blockers", value: "0" }
    ],
    items: lifecycleItems
  },
  salary: {
    title: "Salary History",
    description: "Permission-protected salary records with approval trail, effective date, and finance/payroll visibility.",
    metrics: [
      { label: "Salary-ready", value: "242" },
      { label: "Missing salary", value: "11" },
      { label: "Pending approvals", value: "4" }
    ],
    items: lifecycleItems
  },
  documents: {
    title: "Employee Documents",
    description: "Employee file storage with visibility levels for contracts, IDs, evaluations, warnings, salary, and exit documents.",
    metrics: [
      { label: "Uploaded documents", value: "914" },
      { label: "Sensitive files", value: "127" },
      { label: "Missing contracts", value: "9" }
    ],
    items: lifecycleItems
  },
  achievements: {
    title: "Achievements & Recognition",
    description: "Recognition records for sales targets, attendance, customer service, leadership, process improvement, and compliance.",
    metrics: [
      { label: "This quarter", value: "33" },
      { label: "Pending approval", value: "6" },
      { label: "Top performers", value: "12" }
    ],
    items: lifecycleItems
  },
  evaluations: {
    title: "Employee Evaluations",
    description: "Role-aware performance review workflow controlled by permissions and reporting scope.",
    metrics: [
      { label: "Drafts", value: "18" },
      { label: "Submitted", value: "14" },
      { label: "Overdue", value: "5" }
    ],
    items: lifecycleItems
  },
  "evaluation-criteria": {
    title: "Evaluation Criteria Setup",
    description: "Configurable scoring criteria by role and department with weights, max score, and active status.",
    metrics: [
      { label: "Active criteria", value: "10" },
      { label: "Role-specific", value: "7" },
      { label: "Department-specific", value: "4" }
    ],
    items: [
      { id: "sales", primary: "Sales performance", secondary: "DSA, DSP, EBU sales", status: "Active", owner: "Sales Head", updated: "Seed" },
      { id: "attendance", primary: "Attendance", secondary: "All roles", status: "Active", owner: "HR Manager", updated: "Seed" },
      { id: "control", primary: "Financial control", secondary: "Finance", status: "Active", owner: "Finance Director", updated: "Seed" }
    ]
  },
  onboarding: {
    title: "Onboarding Checklist",
    description: "Checklist workflow for ID, contract, emergency contact, bank details, role, manager, evaluator, salary, and documents.",
    metrics: [
      { label: "Open checklists", value: "14" },
      { label: "Ready to activate", value: "6" },
      { label: "Blocked", value: "3" }
    ],
    items: lifecycleItems
  },
  leave: {
    title: "Leave Records",
    description: "Leave requests, approval status, date ranges, and employee lifecycle status impact.",
    metrics: [
      { label: "Open requests", value: "8" },
      { label: "On leave", value: "17" },
      { label: "Approved this month", value: "31" }
    ],
    items: lifecycleItems
  },
  disciplinary: {
    title: "Disciplinary Records",
    description: "Restricted incident and warning records with follow-up status and attachments.",
    metrics: [
      { label: "Open records", value: "3" },
      { label: "Follow-ups due", value: "2" },
      { label: "Closed this quarter", value: "9" }
    ],
    items: lifecycleItems
  },
  termination: {
    title: "Termination / Exit Workflow",
    description: "Termination, resignation, clearance, final payment review, asset return, and final status workflow.",
    metrics: [
      { label: "Open exits", value: "4" },
      { label: "Final payment review", value: "2" },
      { label: "Completed exits", value: "18" }
    ],
    items: lifecycleItems
  },
  imports: {
    title: "HR File Import",
    description: "Upload Excel or CSV, inspect columns, map fields, normalize values, and validate before saving approved rows.",
    metrics: [
      { label: "Validated batches", value: "12" },
      { label: "Clean rows", value: "431" },
      { label: "Review rows", value: "42" }
    ],
    items: [
      { id: "imp1", primary: "June field update.xlsx", secondary: "Sheet1 / 140 rows", status: "Review required", owner: "HR Officer", updated: "Today" },
      { id: "imp2", primary: "Head office cleanup.csv", secondary: "CSV / 38 rows", status: "Approved", owner: "HR Manager", updated: "Jun 16" },
      { id: "imp3", primary: "Shop clusters.xlsx", secondary: "Clusters / 72 rows", status: "Blocked", owner: "HR Officer", updated: "Jun 14" }
    ]
  },
  "imports/preview": {
    title: "Import Validation Preview",
    description: "Clean records, blockers, warnings, and review items are separated so HR can fix ambiguity before approval.",
    metrics: [
      { label: "Blockers", value: "8" },
      { label: "Warnings", value: "21" },
      { label: "Review items", value: "13" }
    ],
    items: validationRows.map((row) => ({
      id: row.id,
      primary: `${row.employeeId} - ${row.name}`,
      secondary: row.issue,
      status: row.status,
      owner: row.severity,
      updated: "Preview"
    }))
  },
  reports: {
    title: "Reports",
    description: "Exportable dashboards for employees, lifecycle status, missing data, evaluations, achievements, imports, and audit history.",
    metrics: [
      { label: "Report templates", value: "17" },
      { label: "CSV exports", value: "Permissioned" },
      { label: "Excel exports", value: "Permissioned" }
    ],
    items: reportCards.map(([primary, secondary], index) => ({
      id: String(index),
      primary,
      secondary,
      status: "Configured",
      owner: "Reports",
      updated: "Seed"
    }))
  },
  users: {
    title: "User & Role Management",
    description: "System roles, permission grants, employee-linked accounts, and least-privilege access management.",
    metrics: [
      { label: "System roles", value: "18" },
      { label: "Permissions", value: "23" },
      { label: "Locked users", value: "0" }
    ],
    items: [
      { id: "u1", primary: "hr.admin@leapfrog.local", secondary: "HR Admin", status: "Active", owner: "Super Admin", updated: "Seed" },
      { id: "u2", primary: "finance@leapfrog.local", secondary: "Finance Payroll", status: "Active", owner: "Super Admin", updated: "Seed" },
      { id: "u3", primary: "auditor@leapfrog.local", secondary: "Auditor", status: "Active", owner: "Super Admin", updated: "Seed" }
    ]
  },
  audit: {
    title: "Audit Logs",
    description: "Immutable trail for employee, salary, status, assignment, document, evaluation, termination, import, and permission events.",
    metrics: [
      { label: "Logged actions", value: "16" },
      { label: "Sensitive events", value: "Tracked" },
      { label: "Retention", value: "Configured" }
    ],
    items: [
      { id: "a1", primary: "EMPLOYEE_CREATE", secondary: "Employee LSTA_0004", status: "Captured", owner: "HR Officer", updated: "Today" },
      { id: "a2", primary: "SALARY_CHANGE", secondary: "Employee LSTA_0003", status: "Captured", owner: "Finance Payroll", updated: "Yesterday" },
      { id: "a3", primary: "IMPORT_APPROVAL", secondary: "June field update.xlsx", status: "Captured", owner: "HR Manager", updated: "Jun 16" }
    ]
  }
};

