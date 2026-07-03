# Phase 4C.2 Review Checklist — Shop Manager Incentive & KPI Calculation

## Schema & Data
- [ ] 5 new Prisma models exist
- [ ] 6 new enums (IncentivePeriodStatus, PerformanceInputStatus, CalculationStatus, IncentiveComponentCode, IncentiveIssueSeverity, IncentiveIssueCode)
- [ ] 17 new audit action entries in AuditAction enum
- [ ] `prisma db push` applies without conflicts
- [ ] 97 total permissions seeded
- [ ] 10 incentive PayrollInputTypes seeded
- [ ] Cleanup order handles all 5 new models

## Calculation Engine (`src/lib/shop-manager-incentives.ts`)
- [ ] `calculateShopManagerIncentive` computes all 9 components + TOTAL
- [ ] QGA Bonus: 5000/3000/1500 based on criteria when achievement > 90%
- [ ] QGA SIM Commission: count×1.5/count×1/0 based on criteria when achievement > 90%
- [ ] EVD Bonus: 3000/2000/0 based on criteria when achievement > 100% AND reconciled
- [ ] BA/Site Bonus: 4000/2000/0 based on criteria when requirement met
- [ ] M-PESA Commission: float×2%/float×2%/0 when target achieved AND reconciled
- [ ] DSA Achievement Bonus: 2000/1500/1000/0 based on % thresholds
- [ ] QO Target Bonus: 4000/0 based on > 90% threshold
- [ ] EBU Activation Bonus: 3000/1500/500 when target achieved AND revenue > 0 AND topup > 500
- [ ] EBU Revenue Share: 25%/15%/0 based on first-month leapfrog revenue
- [ ] AT_RISK: all components = 0
- [ ] UNASSIGNED: blocked, returns 0
- [ ] `calculateAllShopManagerIncentives` batch orchestrates per-period calculation
- [ ] `sendApprovedIncentivesToPayrollInputs` handles 3 overwrite modes
- [ ] Never overwrites locked payroll inputs

## API Routes

### Period Routes (9)
- [x] GET /periods — list with pagination
- [x] POST /periods — create with Zod validation
- [x] GET /periods/[id] — detail
- [x] PATCH /periods/[id] — update
- [x] POST /periods/[id]/open — DRAFT → OPEN_FOR_INPUT
- [x] POST /periods/[id]/calculate — trigger calculation
- [x] POST /periods/[id]/start-review — CALCULATED → UNDER_REVIEW
- [x] POST /periods/[id]/approve — UNDER_REVIEW → APPROVED
- [x] POST /periods/[id]/lock — APPROVED → LOCKED
- [x] POST /periods/[id]/cancel — any status → CANCELLED
- [x] GET /periods/[id]/dashboard — stats + audit logs

### Input Routes (6)
- [x] GET /periods/[id]/inputs — list with scope filter
- [x] POST /periods/[id]/inputs — create with auto-population
- [x] GET /periods/[id]/inputs/[inputId] — detail
- [x] PATCH /periods/[id]/inputs/[inputId] — update (DRAFT/RETURNED only)
- [x] POST /periods/[id]/inputs/[inputId]/submit — any → SUBMITTED
- [x] POST /periods/[id]/inputs/[inputId]/accept — SUBMITTED/RETURNED → ACCEPTED
- [x] POST /periods/[id]/inputs/[inputId]/reject — SUBMITTED → REJECTED
- [x] POST /periods/[id]/inputs/[inputId]/return — SUBMITTED → RETURNED

### Import/Export/Payroll (5)
- [x] GET /periods/[id]/template — CSV template download
- [x] POST /periods/[id]/import — preview with validation
- [x] POST /periods/[id]/import/confirm — execute import
- [x] GET /periods/[id]/export — CSV export with component columns
- [x] POST /periods/[id]/send-to-payroll-inputs — handoff to payroll inputs

## RBAC
- [ ] 11 permissions assigned per role spec
- [ ] SUPER_ADMIN has all 11
- [ ] HR_ADMIN has all 11
- [ ] SALES_HEAD has all except lock
- [ ] ASM has view/input/review
- [ ] SHOP_MANAGER has view
- [ ] FINANCE_DIRECTOR has view/review/approve/lock/export/sendToPayroll
- [ ] FINANCE_PAYROLL has view/review/export/sendToPayroll
- [ ] AUDITOR has view/export
- [ ] EMPLOYEE has none

## Scope Enforcement
- [ ] HR Admin sees all
- [ ] Sales Head sees all
- [ ] ASM sees assigned area only
- [ ] Shop Manager sees own shop only
- [ ] Finance/Auditor see all
- [ ] Employee sees none

## UI Pages (7)
- [ ] `/shop-manager-incentives` — list with status badges, actions, filters
- [ ] `/shop-manager-incentives/new` — create form with payroll period select
- [ ] `/shop-manager-incentives/[id]` — dashboard with metric cards, action buttons
- [ ] `/shop-manager-incentives/[id]/inputs` — input table with inline edit, submit/accept/reject/return
- [ ] `/shop-manager-incentives/[id]/calculations` — calculation breakdown with expandable components
- [ ] `/shop-manager-incentives/[id]/review` — review cards, approve/return/reject, batch approve
- [ ] `/shop-manager-incentives/[id]/import` — template download, file upload, preview, confirm

## Tests (121)
- [ ] 55 permission assertion checks across all 11 permissions and 10 roles
- [ ] 4 incentive period CRUD + lifecycle state transitions
- [ ] 9 input state transitions (submit/accept/reject/return)
- [ ] 33 calculation rule assertions (QGA ×4, QGA SIM ×3, EVD ×4, BA ×4, M-PESA ×2, DSA ×4, QO ×2, EBU Activation ×4, EBU Rev Share ×3, AT_RISK ×2, UNASSIGNED ×2, total ×3)
- [ ] Scope assertions (HR, Sales Head, ASM, Shop Manager, Finance, Auditor)
- [ ] 10 payroll input type seeded assertions
- [ ] Regression checks
- [ ] Cleanup succeeds without errors

## Quality Gates
- [ ] `tsc --noEmit` passes (0 errors)
- [ ] `npm run lint` passes (0 errors, warnings only)
- [ ] `npm run build` passes (68 routes + pages)
