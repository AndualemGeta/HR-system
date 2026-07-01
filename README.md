# Leapfrog HR Management System — Phase 3.5

Secure, role-based HR employee registration and management system for Leapfrog Software Technology Africa PLC.

**Phase 3.5 adds:**
- Data quality dashboard with scan/severity grading and issue resolution
- Sensitive payroll field change request workflow (maker-checker approval)
- Salary rule activation/deactivation approval workflow (FINANCE_DIRECTOR)
- HR review checklist / Phase Control page for go-live tracking
- Sensitive fields: basicSalary, salaryEffectiveDate, paymentMethod, bankName/BankAccountNumber, mpesaAccount, taxId, pensionId, costCenter
- Permissions: dataQuality.view/manage, changeRequest.view/create/approve/reject/cancel, salaryRuleApproval.view/request/approve/reject, phaseControl.view/update

**Phase 3 added:**
- Salary structure dashboard with pay component definitions
- Role-based pay rules with effective-date management
- Rule preview calculator (FIXED_AMOUNT, PERCENTAGE, THRESHOLD, TIERED, MANUAL_INPUT)
- Component rule activation/deactivation with duplicate prevention
- Permissions: salaryStructure.view/manageComponents/manageRules/preview/activateRule/deactivateRule/auditView

**Phase 2B added:**
- Employee import from Excel/CSV with column mapping wizard
- Validation with ERROR/WARNING/DUPLICATE blocking
- Import history and audit trail
- Employee payroll readiness dashboard with 8-check assessment
- Payroll readiness CSV export
- Employee payroll profiles (payment method, bank, tax ID, pension, cost center)

## Tech Stack

- Next.js 15 App Router + TypeScript
- Prisma ORM + PostgreSQL
- Email/password auth with HTTP-only cookies
- RBAC with 39 granular permission keys across 12 roles
- bcryptjs password hashing (12 rounds)
- Zod request validation
- Audit logging for all sensitive actions (45 audit actions)
- CSV/XLSX parsing (PapaParse + ExcelJS)
- File upload to local filesystem

## What's Implemented

- **Authentication:** Login, logout, session management, account lockout after 5 failures
- **Employee Registration — Category Selection:** Two-step flow with Head Office or Shop/Field
- **Employee Registration — Head Office & Shop/Field Forms:** Category-specific fields, role-based defaults
- **Shop Accountant Dual Reporting:** Operational + accounting reporting manager
- **Employee Profile & List:** Category badges, tabs, search, filter, pagination
- **Organization Data:** Departments, regions, areas, shops (Ethiopia-oriented)
- **Salary Access Control:** salary.view required; REDACTED for unauthorized
- **Employee Documents:** Upload, list, download, deactivate with visibility levels
- **Required Document Rules:** Configurable per role/category/employment type
- **Onboarding Completion:** Validation with HR Admin override
- **Employee Import:** CSV/XLSX upload, auto-map columns, validate/preview/confirm
- **Import History:** Browseable list with row-level detail
- **Payroll Readiness Dashboard:** 8-check assessment with CSV export
- **Salary Structure Dashboard:** Summary counts of components and rules
- **Pay Components:** CRUD with tax treatment, earning/deduction classification
- **Pay Rules:** CRUD with FIXED_AMOUNT/PERCENTAGE/THRESHOLD/TIERED/MANUAL_INPUT methods
- **Rule Activation/Deactivation:** Validation (including duplicate prevention), status management
- **Rule Preview:** Test a rule against a sample input value with explanation and warnings
- **Rule Matching Engine:** Scope-based matching (role, category, department, region, area, shop, employment type) with effective date range and priority
- **Audit Logging:** PAY_COMPONENT_CREATE/UPDATE/DEACTIVATE, PAY_RULE_CREATE/UPDATE/ACTIVATE/DEACTIVATE, PAY_RULE_PREVIEW
- **Seed Data:** 8 pay components, 4 pay rules (DSA Transport, KPI Allowance, Manual Adjustment, DSA Commission)
- **Data Quality Dashboard:** Scan all employees for 20+ issue types (BLOCKER/WARNING/INFO), resolve or ignore with reason
- **Change Request Workflow:** Requester creates change → Approver reviews/approves/rejects → Auto-applies field on approval
- **Salary Rule Approval Workflow:** Request activation/deactivation → FINANCE_DIRECTOR approves/rejects → Auto-activates/deactivates rule
- **Phase Control Checklist:** 16-item go-live checklist across all phases, trackable by status/comment/owner
- **Rule Activation via Approval:** Direct activate/deactivate replaced with approval workflow (Super Admin retains emergency override)
- **Employee Edit Routing:** basicSalary and salaryEffectiveDate changes auto-create change requests during employee edit

## What's NOT Implemented (Planned for Later Phases)

| Feature | Status |
|---|---|
| Monthly payroll calculation & payslips | PLANNED |
| Ethiopian PAYE tax brackets | PLANNED |
| Pension rules & contributions | PLANNED |
| Allowance/commission computation | PLANNED |
| Payroll approval workflow | PLANNED |
| Payment export (bank/MPESA) | PLANNED |
| Leave requests & balances | PLANNED |
| Employee evaluations | PLANNED |
| Disciplinary records | PLANNED |
| Termination & exit workflows | PLANNED |
| Transfers & promotions | PLANNED |
| Employee self-service | PLANNED |
| External integrations | PLANNED |

Phase 3.5 is data-protection and approval workflow setup only — does not calculate payroll, tax, pension, or generate payslips/exports.

Schema models for additional future features exist in the database but have no APIs, pages, or tests in this build.

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
| `finance.director@leapfrog.com` | FINANCE_DIRECTOR | Selamawit Gebre (Finance Director) — has full salary structure permissions |
| `finance.payroll@leapfrog.com` | FINANCE_PAYROLL | Genet Mengistu (Accountant) — has view + preview |
| `treasury@leapfrog.com` | TREASURY_MANAGER | Henok Desta (Treasury Manager) — has view + preview |
| `sales.head@leapfrog.com` | SALES_HEAD | Biruk Tadesse (Sales Head, Head Office) |
| `asm@leapfrog.com` | ASM | Aster Desta (ASM, Shop/Field — Megenagna Area) |
| `shop.manager@leapfrog.com` | SHOP_MANAGER | Tesfaye Hailu (Shop Manager) |
| `shop.manager2@leapfrog.com` | SHOP_MANAGER | Lemlem Berhe (Shop Manager) |
| `dsp@leapfrog.com` | DSP | Kidus Yohannes |
| `dsa@leapfrog.com` | DSA | Meron Tadesse |
| `shopacct@leapfrog.com` | SHOP_ACCOUNTANT | Bezawit Assefa |
| `employee@leapfrog.com` | EMPLOYEE | Employee User |
| `auditor@leapfrog.com` | AUDITOR | Yonas Tadesse |

## Tests

```powershell
npm test                # Run all tests (42 baseline + 41 Phase 2A + 68 Phase 2B + 62 Phase 3 + 68 Phase 3.5)
npm run test:phase1     # Run baseline tests only (42)
npm run test:phase2a    # Run Phase 2A tests only (41)
npm run test:phase2b    # Run Phase 2B tests only (68)
npm run test:phase3     # Run Phase 3 tests only (62)
npm run test:phase3_5   # Run Phase 3.5 tests only (68)
npm run typecheck
npm run lint
npm run build
```

All pass clean — 281 total tests covering authentication, RBAC, employee registration, salary visibility, assignments, audit logging, organization data, document upload/visibility/download/deactivation, required document rules, onboarding completion, import normalization/column mapping/validation/confirm, payroll readiness, pay component CRUD, pay rule CRUD, rule activation/deactivation, preview calculations, data quality scanning/resolution, change request workflow (create/approve/reject/cancel), salary rule approval workflow (request/approve/reject), phase control checklist, and regression.

## Key Design Decisions

- Employee registration starts with category selection (Head Office vs Shop/Field)
- Employee IDs use `LSTA_NNNN` format with never-resetting sequential generation
- Role-based default manager logic: ASM → Sales Head, Shop Manager → ASM, DSP/DSA → Shop Manager, SHOP_MANAGER → SALES_HEAD
- Shop Accountant has dual reporting: operational (shop) + accounting (HO Treasury)
- Salary is redacted without salary.view permission
- Document visibility levels protect sensitive documents
- Required document rules filter by applicability; non-applicable rules excluded from completion %
- Import matching priority: employeeId → email → phone → name+role → name+phone
- Import returns NO_MATCH/SINGLE_MATCH/AMBIGUOUS_MATCH; ambiguous rows blocked
- Payroll readiness: 8 independent checks (salary, payment info, method, tax, pension, assignment, manager, category)
- Phase 3/3.5 is salary-structure setup & data protection only — no monthly payroll, payslips, tax, pension, or payment export
- Phase 3 rule preview is preview-only — does not create payroll records
- Phase 3 PayComponent.taxTreatment defaults to UNKNOWN — finalized in later phase
- Phase 3 rule activation blocks duplicates for same component+scope+effectiveDate
- Phase 3 tier config values must be ordered correctly; no negative amounts
- Phase 3 DSA Transport: THRESHOLD rule pays 1,500 birr flat when sales >= 40%, 0 below
- Phase 3 DSA KPI: TIERED rule with flat amounts (2000 >=60%, 1000 >=40%, 0 below)
- Phase 3.5 rules become ACTIVE only through approval workflow (create/patch reject ACTIVE)
- Phase 3.5 sensitive payroll fields require change request approval before update
- Phase 3.5 requester cannot approve own change request or salary rule approval
- Phase 3.5 FINANCE_DIRECTOR approves salary rule activation; HR_ADMIN approves HR master-data change requests
- Phase 3.5 data quality scan detects 20+ issue types across all employees
- Phase 3.5 change request auto-applies the field value on approval
- Phase 3.5 rule activation validates scope and duplicate rules before submitting for approval
- Phase 3.5 phase control checklist tracks go-live readiness across all phases

## Known Limitations

- File upload uses local filesystem (`uploads/employee-documents/`)
- Phase 3/3.5 is salary-structure setup & data protection only — no monthly payroll, payslips, tax, pension, or payment export
- Phase 3 rule preview is informational — does not create actual payroll records
- Payroll readiness is informational only — no enforcement or auto-correction
- No email notifications for any system event
- Pay component tax treatment defaults to UNKNOWN — Ethiopian tax rules not hardcoded
- Commission rules are structural only — no final commission calculation in Phase 3/3.5
- Import does not auto-assign employees to shops (assignment done separately)
- Data quality scan is manual trigger — no scheduled scans
- Change request does not generate notifications to approvers
- Rule approval still allows emergency direct activate via existing /activate endpoint (Super Admin only)
