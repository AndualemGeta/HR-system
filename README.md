# Leapfrog HR Management System — Starter Workflow

Secure, role-based HR employee registration system for Leapfrog Software Technology Africa PLC.

**This starter build supports employee registration for Head Office and Shop/Field employees only.** Payroll, leave, documents, evaluations, commission, termination, and advanced workflows are planned for later phases.

## Tech Stack

- Next.js 15 App Router + TypeScript
- Prisma ORM + PostgreSQL
- Email/password auth with HTTP-only cookies
- RBAC with 20 granular permission keys across 12 roles
- bcryptjs password hashing (12 rounds)
- Zod request validation
- Audit logging for all sensitive actions

## What's Implemented

- **Authentication:** Login, logout, session management, account lockout after 5 failures, inactive user blocking, audit logging for login/failed login
- **Employee Registration — Category Selection:** First screen asks HR to choose Head Office Department or Shop/Field Structure
- **Employee Registration — Head Office Form:** Category-specific form requiring department, position/role, direct manager; does not require shop or cluster
- **Employee Registration — Shop/Field Form:** Category-specific form requiring region/area, shop (for most roles), position/role; role-based default manager logic (ASM → Sales Head, Shop Manager → ASM, DSP/DSA → Shop Manager)
- **Shop Accountant Dual Reporting:** Shop Accountant has operational shop assignment + accounting reporting manager (defaults to HO Treasury Manager)
- **Employee Profile:** Shows category badge (Head Office / Shop/Field), organization info, current assignment, salary visibility restricted by permission
- **Employee List:** Filterable by category (All, Head Office, Shop/Field), searchable by name/ID/email
- **Organization:** Departments (CEO, Sales, Distribution, Finance, HR, Technology), Regions (Addis Ababa), Areas (Megenagna, Shiromeda), Shops (Megenagna, Shiromeda, Wossen, Bole Arabsa, Meri Ayat, Ayat Tafo)
- **Employee CRUD:** List with pagination/search/filter, create with auto-generated IDs (LSTA_NNNN), update with audit
- **Assignments:** One active primary assignment per employee; history preserved
- **Status History:** Record employment status changes with audit trail
- **Onboarding Checklists:** 11 standard items per employee; toggle completion
- **Salary:** salary.view permission required for visibility; salary.update for write; REDACTED in API for unauthorized roles
- **Audit Logs:** Browseable log; audits for employee create/update, status change, salary change, manager change, accounting manager change, login success/failure
- **Page Guards:** All pages check authentication and required permissions; redirect to login if unauthorized
- **Navigation:** Permission-filtered navigation grouped by HR, Finance, Reports & Audit, Administration sections

## What's NOT Implemented (Planned for Later Phases)

| Feature | Status |
|---|---|
| Document upload & management | PLANNED |
| Leave requests & balances | PLANNED |
| Employee evaluations | PLANNED |
| Payroll preparation & calculation | PLANNED |
| Commission plans | PLANNED |
| Disciplinary records | PLANNED |
| Termination & exit workflows | PLANNED |
| Transfers & promotions | PLANNED |
| Employee self-service | PLANNED |
| External integrations | PLANNED |

Schema models for these future features exist in the database but have no APIs, pages, or tests in this starter build.

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` with your PostgreSQL connection string and a secure `AUTH_SECRET`.

```powershell
npx prisma db push --force-reset
npx tsx prisma/seed.ts
npm run dev
```

Open `http://localhost:3000`.

## Demo Users (password: Test123!)

| Email | Role | Employee Record |
|---|---|---|
| `admin@leapfrog.com` | SUPER_ADMIN | Abebe Kebede (CEO, Head Office) |
| `hr.admin@leapfrog.com` | HR_ADMIN | Almaz Tesfaye (HR Manager, Head Office) |
| `hr.officer@leapfrog.com` | HR_OFFICER | Dawit Eshetu (HR Officer, Head Office) |
| `finance.director@leapfrog.com` | FINANCE_DIRECTOR | Selamawit Gebre (Finance Director, Head Office) |
| `finance.payroll@leapfrog.com` | FINANCE_PAYROLL | Genet Mengistu (Accountant, Head Office) |
| `treasury@leapfrog.com` | TREASURY_MANAGER | Henok Desta (Treasury Manager, Head Office) |
| `sales.head@leapfrog.com` | SALES_HEAD | Biruk Tadesse (Sales Head, Head Office) |
| `asm@leapfrog.com` | ASM | Aster Desta (ASM, Shop/Field — Megenagna Area) |
| `shop.manager@leapfrog.com` | SHOP_MANAGER | Tesfaye Hailu (Shop Manager, Shop/Field — Megenagna) |
| `employee@leapfrog.com` | EMPLOYEE | Kidus Yohannes (DSP), Meron Tadesse (DSA), Bezawit Assefa (Shop Accountant) |
| `auditor@leapfrog.com` | AUDITOR | Yonas Tadesse (Auditor) |

## Tests

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

All pass clean — 42 tests covering authentication, RBAC, employee ID, Head Office registration, Shop/Field registration, salary visibility, assignments, audit logging, and organization data.

## Key Design Decisions

- Employee registration starts with category selection (Head Office vs Shop/Field), driving which fields are required
- Employee IDs use `LSTA_NNNN` format with never-resetting sequential generation
- Role-based default manager logic: ASM defaults to Sales Head, Shop Manager defaults to ASM, DSP/DSA default to Shop Manager
- Shop Accountant has dual reporting: operational (shop) + accounting (HO Treasury Manager/Accountant)
- Salary is redacted in API responses for users without `salary.view` permission — not just hidden in UI
- `AUTH_SECRET` is required in production — the app fails loudly at startup if missing
- Assignment history is preserved; one active primary assignment per employee
- Onboarding checklists are auto-created for DRAFT/ONBOARDING status employees
- Audit logs record user, action, entity type/id, old/new values
- All Ethiopia-oriented data — no unrelated sample locations (no Kathmandu)

## Known Limitations

- Employee registration form does not include file/document upload
- No email delivery is configured
- No self-service employee/manager views
- Manager scope (ASM sees own area, Shop Manager sees own shop) is enforced at data level but not yet at API query level
- Salary redaction for unauthorized roles is handled at API level
