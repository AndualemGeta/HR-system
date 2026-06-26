# Leapfrog HR Management System — Phase 1

Secure, role-based HRIS foundation for Leapfrog Software Technology Africa PLC.

**Phase 1 scope:** HRIS foundation only. Advanced HR operations (documents, leave, evaluations, disciplinary, payroll, commission, etc.) are planned for later phases.

## Tech Stack

- Next.js 15 App Router + TypeScript
- Prisma ORM + PostgreSQL
- Email/password auth with JWT (jose) + HTTP-only cookies
- RBAC with 20 granular permission keys across 18 roles
- bcryptjs password hashing (12 rounds)
- Zod request validation
- Audit logging for all sensitive actions

## What's Implemented

- **Authentication:** Login, logout, session management, account lockout after 5 failures, inactive user blocking, audit logging for login/failed login/logout
- **Users & Roles:** 18 seeded roles (SUPER_ADMIN, CEO, HR_ADMIN, HR_MANAGER, HR_OFFICER, FINANCE_DIRECTOR, FINANCE_PAYROLL, SALES_HEAD, SHOP_MANAGER, EMPLOYEE, AUDITOR, etc.)
- **Permissions:** 20 Phase 1 permissions controlling employee, salary, status, assignment, onboarding, reports, audit, user, role, and organization access
- **Organization:** Department tree (Head Office, HR, Finance, Sales, Distribution, Technology) with parent/child hierarchy
- **Locations:** Ethiopia-oriented — Addis Ababa Head Office, East Addis regions, shops (Bole Arabsa, Megenagna, etc.), clusters
- **Employee CRUD:** List with pagination/search, create with auto-generated IDs (LSTA_NNNN), update with audit
- **Assignments:** View and create employee assignments; one active assignment per employee enforced
- **Status History:** View and record employment status changes with audit trail
- **Onboarding Checklists:** 11 standard items per employee (ID, contract, emergency contact, etc.), toggle completion
- **Salary Records:** Create and view salary history; salary.update permission required for write access; salary.view controls visibility
- **Audit Logs:** Browseable log of all audited actions across the system
- **Reports Dashboard:** Employee counts by department/role/type, recently added, missing manager/employment type counts
- **Page Guards:** All pages check authentication and required permissions; redirect to login or dashboard if unauthorized
- **Navigation:** Permission-filtered navigation grouped by HR, Finance, Reports & Audit, Administration sections

## What's NOT Implemented (Planned for Later Phases)

| Feature | Status |
|---|---|
| Document upload & management | PLANNED (Phase 2) |
| Leave requests & balances | PLANNED (Phase 2) |
| Employee evaluations | PLANNED (Phase 2) |
| Achievements & recognition | PLANNED (Phase 2) |
| Disciplinary records | PLANNED (Phase 3) |
| Termination & exit workflows | PLANNED (Phase 3) |
| Transfers & promotions | PLANNED (Phase 3) |
| Approval routing engine | PLANNED (Phase 3) |
| Notifications | PLANNED (Phase 3) |
| Payroll preparation & calculation | PLANNED (Phase 4) |
| Commission plans | PLANNED (Phase 4.5) |
| PAYE tax & pension rules | PLANNED (Phase 4.5) |
| Employee self-service | PLANNED (Phase 3) |
| External integrations | PLANNED (Phase 5) |

Schema models for these future features exist in the database but have no APIs, pages, or tests in this phase.

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` with your PostgreSQL connection string and a secure `AUTH_SECRET`.

```powershell
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open `http://localhost:3000`.

## Demo Users

| Email | Password | Role |
|---|---|---|
| `admin@leapfrog.com` | `Admin123!` | SUPER_ADMIN |
| `ceo@leapfrog.com` | `Ceo123!` | CEO |
| `hr.admin@leapfrog.com` | `HrAdmin123!` | HR_ADMIN |
| `hr.manager@leapfrog.com` | `Hr123!` | HR_MANAGER |
| `hr.officer@leapfrog.com` | `HrOff123!` | HR_OFFICER |
| `finance.director@leapfrog.com` | `Fin123!` | FINANCE_DIRECTOR |
| `finance.payroll@leapfrog.com` | `FinPay123!` | FINANCE_PAYROLL |
| `sales.head@leapfrog.com` | `Sales123!` | SALES_HEAD |
| `shop.manager@leapfrog.com` | `Shop123!` | SHOP_MANAGER |
| `manager@leapfrog.com` | `Mgr123!` | AREA_SALES_MANAGER |
| `employee@leapfrog.com` | `Emp123!` | EMPLOYEE |
| `auditor@leapfrog.com` | `Audit123!` | AUDITOR |

## Test

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

All pass clean — 33 tests covering authentication, RBAC, employee, salary, onboarding, assignment, status, reports, audit logs, organization, and users.

## Key Design Decisions

- Employee IDs use `LSTA_NNNN` format with never-resetting sequential generation
- All monetary fields use `@db.Decimal` with appropriate precision
- Self-referencing models (Department, Location, Employee) use explicit `@relation` with named inverse fields
- Permissions are enforced on both API and page level; frontend hiding is not treated as sufficient security
- Salary data is served in API responses but should be redacted at the frontend layer for unauthorized roles
- `AUTH_SECRET` is required in production — the app fails loudly at startup if missing
- Onboarding checklist completion is required before ACTIVE status (enforced at API level)
- Assignment history closes the previous active assignment when a new one is created
- Status changes record previous and new status with reason and audit trail
- Audit logs record user, action, entity type/id, old/new values, and IP address
- Reports respect role permissions at the API level; no company-wide data exposed to employees

## Known Limitations

- Employee ACTIVE status enforcement (requires onboarding completion) is at API level but not yet strict — override is implicit through the status-update API
- No email delivery is configured
- No external integrations are connected
- Self-service employee/manager views are not implemented
- Salary redaction for unauthorized roles is handled at the API response level but the frontend should also explicitly hide salary fields

## Next Steps

Phase 2 should add: document upload/management, leave records, employee evaluations, achievements, import validation, and expanded reports.
