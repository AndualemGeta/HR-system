# Leapfrog HR Management System — Phase 4C.2

Secure, role-based HR employee registration and management system for Leapfrog Software Technology Africa PLC.

**Phase 3.5 adds:**
- Data quality dashboard with scan/severity grading and issue resolution
- Sensitive payroll field change request workflow (maker-checker approval)
- Salary rule activation/deactivation approval workflow (FINANCE_DIRECTOR)
- HR review checklist / Phase Control page for go-live tracking
- Sensitive fields: basicSalary, salaryEffectiveDate, paymentMethod, bankName/BankAccountNumber, mpesaAccount, taxId, pensionId, costCenter
- Permissions: dataQuality.view/manage, changeRequest.view/create/approve/reject/cancel, salaryRuleApproval.view/request/approve/reject, phaseControl.view/update

**Phase 4C.1 adds — Shop Master and Shop Status Setup:**
- Shop Master Management — create, edit, deactivate, reactivate shops using the existing Location model
- Shop Profile — corridor type (CORRIDOR/NON_CORRIDOR/UNKNOWN), incentive eligibility, default shop manager
- Shop Criteria Status — manual criteria setting (GOLD/SILVER/BRONZE/AT_RISK/UNASSIGNED) with effective-dated history
- Hierarchy: Region → Area → Cluster → Shop (cluster optional)
- Scope enforcement: HR Admin all shops, Sales Head all shops, ASM assigned area only, Shop Manager own shop only, Finance/Auditor view all, Employee no access
- Audit logging: SHOP_CREATE, SHOP_UPDATE, SHOP_DEACTIVATE, SHOP_REACTIVATE, SHOP_MANAGER_ASSIGN, SHOP_CRITERIA_UPDATE, SHOP_PROFILE_UPDATE
- Permissions: shop.view, shop.create, shop.update, shop.deactivate, shop.reactivate, shop.assignManager, shop.updateCriteria, shop.viewCriteriaHistory
- UI pages: /shops (list with filters), /shops/new (create), /shops/[id] (detail), /shops/[id]/edit (edit), /shops/[id]/criteria (update criteria)
- New models: ShopProfile (corridorType, defaultShopManagerId, isIncentiveEligible), ShopCriteriaStatusHistory (criteria, effectiveFrom/To, reason)
- 85 tests

**Phase 4C.2 adds — Shop Manager Incentive (Management Input Form Design):**
- Management Input Form design: period-based, department-owned input fields, no approval/review workflow
- Period Management — CRUD with lifecycle: DRAFT → OPEN → CALCULATED → CANCELLED (no review/approve/lock states)
- Input Management — create and update department-scoped performance inputs (Google Sheet-style table)
- 9 Incentive Component Calculations: QGA Bonus (5K/3K/1.5K), QGA SIM Commission (count×1.5/count×1/0), EVD Bonus (3K/2K/0), BA/Site Bonus (4K/2K/0), M-PESA Commission (float×2%/float×2%/0), DSA Achievement Bonus (2K/1.5K/1K/0), QO Target Bonus (4K/0), EBU Activation Bonus (3K/1.5K/0.5K), EBU Revenue Share (25%/15%/0%)
- Incentive tier amounts based on Shop Criteria (GOLD/SILVER/BRONZE); AT_RISK = all components zeroed
- Department-scoped input ownership: Sales Head (QGA fields), Distribution Head (corridor/EVD/M-PESA/BA fields), EBU Head (EBU fields); inputAll permission overrides all
- At-risk shops: input fields locked (except shopCriteria and responsibleRemarks), all components = 0
- Config-driven input fields via ShopManagerIncentiveInputConfig (inputCode, label, department, type, displayOrder)
- CSV Export of calculated incentives
- Payroll Handoff — sends calculated incentives to Payroll Inputs with SKIP_EXISTING mode
- Batch Calculation Engine — pure sync function for all 9 components; batch orchestrator for per-period calculation
- 10 new permissions: shopManagerIncentive.view/createPeriod/updatePeriod/inputSales/inputDistribution/inputEbu/inputAll/calculate/export/sendToPayroll
- 8 new audit actions: PERIOD_CREATE/UPDATE/OPEN, INPUT_CREATE/UPDATE, CALCULATE, EXPORT, SEND_TO_PAYROLL
- 4 Prisma models: ShopManagerIncentivePeriod, ShopManagerIncentiveInput, ShopManagerIncentiveCalculation, ShopManagerIncentiveInputConfig
- No ShopManagerIncentiveComponent, ShopManagerIncentiveIssue, PerformanceInputStatus, or CalculationStatus models/enums
- 2 new RBAC roles: DISTRIBUTION_HEAD, EBU_HEAD (14 total roles)
- Input fields: qgaAbove90 (Boolean), qgaQuantity (Int), corridorStatus (Boolean), evdAbove100AndReconciled (Boolean), mpesaTargetAndReconciled (Boolean), baSite (Boolean), ebuRevenueMade (Boolean), ebuAverageTopupAbove500 (Boolean), ebuFirstMonthLfRevenue (Decimal), plus legacy numeric fields
- 5 UI pages: Incentive Periods list, New Period, Period Dashboard, Inputs (Google Sheet-style), Calculations
- No Review or Import pages
- Only total incentive is payable (`SHOP_MANAGER_TOTAL_INCENTIVE` payroll input type); individual components are audit details only
- Calculation is atomic (all-or-nothing transaction — entire batch succeeds or rolls back)
- Payroll handoff is atomic (all-or-nothing transaction — all records created or none)
- Department input ownership enforced on POST and PATCH
- Scoped users (ASM, SHOP_MANAGER) see only their shops in all endpoints
- Input changes after calculation trigger recalculation requirement (status reverts)
- Legacy component payroll input types (`SHOP_MANAGER_QGA_BONUS`, etc.) marked inactive
- DELETE input route added (`DELETE /periods/[id]/inputs/[inputId]`)
- Calculations GET endpoint added (`GET /periods/[id]/calculations`)
- 12 API end-to-end test suites covering full lifecycle, scope, ownership, at-risk, recalculation, delete, export, permissions, regression
- GitHub CI pipeline added (`.github/workflows/ci.yml`)
- 180 tests + 12 E2E suites

**Phase 4C.2 does NOT build: approval/review workflow for incentives, final payroll calculation, income tax, pension, net salary, payslip, bank/M-PESA payment export, quarterly auto-calculation, general KPI engine, ASM/DSA commission engine, or attendance/leave management.**

**Phase 4A adds:**
- Payroll Period Setup and Monthly Input Collection
- Builds the first part of monthly salary preparation — creating payroll periods, selecting employees, collecting monthly payroll inputs, and tracking department submission status
- Key features: Payroll Period CRUD, Employee Selection, Input Type Setup, Monthly Input Collection, Department Submission Tracking, CSV Import
- Permissions: payrollPeriod.*, employeeSelection.*, inputType.*, monthlyInput.*, submissionTracking.*, payrollImport.* — SUPER_ADMIN/HR_ADMIN full access, HR_OFFICER limited view/create, FINANCE_DIRECTOR view/open/close/review/export, FINANCE_PAYROLL create/update/submit/review/import/export, SALES_HEAD view/create/submit for shop/field scope, ASM view/create/submit for assigned area scope, SHOP_MANAGER view/create/submit for own shop only, EMPLOYEE no access, AUDITOR view-only

**Phase 4A does NOT calculate payroll, tax, pension, payslips, or payment exports.**

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
- RBAC with 96 granular permission keys across 14 roles
- bcryptjs password hashing (12 rounds)
- Zod request validation
- Audit logging for all sensitive actions (61+ audit actions)
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
| `distribution.head@leapfrog.com` | DISTRIBUTION_HEAD | Mulugeta Ayele (Distribution Head) |
| `ebu.head@leapfrog.com` | EBU_HEAD | Tigist Wondimu (EBU Head) |
| `auditor@leapfrog.com` | AUDITOR | Yonas Tadesse |

## Tests

```powershell
npm test                # Run all tests (42 Phase 1 + 41 Phase 2A + 27 Phase 2B + 38 Phase 3 + 78 Phase 3.5 + 35 Phase 4A + 35 Phase 4B + 91 Phase 4C.1 + 180 Phase 4C.2 = 567) — includes 12 API E2E test suites
npm run test:phase1     # Run baseline tests only (42)
npm run test:phase2a    # Run Phase 2A tests only (41)
npm run test:phase2b    # Run Phase 2B tests only (27)
npm run test:phase3     # Run Phase 3 tests only (38)
npm run test:phase3_5   # Run Phase 3.5 tests only (78)
npm run test:phase4a    # Run Phase 4A tests only (35)
npm run test:phase4b    # Run Phase 4B tests only (35)
npm run test:phase4c1   # Run Phase 4C.1 tests only (91)
npm run test:phase4c2   # Run Phase 4C.2 tests only (180)
npm run typecheck
npm run lint
npm run build
```

All pass clean — 567 tests covering authentication, RBAC, employee registration, salary visibility, assignments, audit logging, organization data, document upload/visibility/download/deactivation, required document rules, onboarding completion, import normalization/column mapping/validation/confirm, payroll readiness, pay component CRUD, pay rule CRUD, rule activation/deactivation, preview calculations, data quality scanning/resolution, change request workflow (create/approve/reject/cancel), salary rule approval workflow (request/approve/reject), phase control checklist, payroll period management, employee selection, input type setup, monthly input collection, department submission tracking, CSV import, shop master CRUD/criteria/permissions, and shop manager incentive lifecycle/calculation rules (all 9 components AT_RISK/permissions/department-scope/atomic-transaction/E2E).

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
- Phase 4C.2 lifecycle: DRAFT → OPEN → CALCULATED → CANCELLED (no review/approve/lock states)
- Phase 4C.2 only total incentive (`SHOP_MANAGER_TOTAL_INCENTIVE`) is payable; all 9 component calculations exist for audit/transparency only
- Phase 4C.2 calculation is atomic — all shops in a period are calculated in a single transaction; partial failure rolls back
- Phase 4C.2 department input ownership enforced at API level: Sales Head writes QGA fields, Distribution Head writes corridor/EVD/M-PESA/BA fields, EBU Head writes EBU fields; inputAll overrides all
- Phase 4C.2 scope rules: HR Admin/Sales Head/Finance/Auditor see all shops, ASM sees assigned area shops, Shop Manager sees own shop only, Employee sees none
- Phase 4C.2 input changes after calculation invalidate the calculation (status reverts to OPEN, recalculation required)
- Phase 4C.2 legacy component payroll input types (individual incentive components) marked inactive — only the total incentive is forwarded to payroll

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
