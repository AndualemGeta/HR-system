# Phase 4C.2 Review Checklist — Shop Manager Incentive (Management Input Form Design)

## Schema & Data
- [x] 4 incentive Prisma models exist: `ShopManagerIncentivePeriod`, `ShopManagerIncentiveInput`, `ShopManagerIncentiveCalculation`, `ShopManagerIncentiveInputConfig`
- [x] No `ShopManagerIncentiveComponent` or `ShopManagerIncentiveIssue` models
- [x] Enums: `IncentivePeriodStatus` has DRAFT/OPEN/CALCULATED/CANCELLED (no UNDER_REVIEW/APPROVED/LOCKED/READY_FOR_CALCULATION)
- [x] AuditAction has: PERIOD_CREATE, PERIOD_UPDATE, PERIOD_OPEN, INPUT_CREATE, INPUT_UPDATE, CALCULATE, EXPORT, SEND_TO_PAYROLL (no review/approve/lock actions)
- [x] `prisma db push --accept-data-loss` applies without conflicts
- [x] 96 total permissions seeded (10 shopManagerIncentive.* keys)
- [x] 14 roles seeded (DISTRIBUTION_HEAD, EBU_HEAD added)
- [x] 15 ShopManagerIncentiveInputConfigs seeded (Sales/Distribution/EBU department ownership)
- [x] Cleanup order handles all 3 incentive models (+ InputConfig)

## Calculation Engine (`src/lib/shop-manager-incentives.ts`)
- [x] `validateShopCriteria` only accepts GOLD/SILVER/BRONZE/AT_RISK
- [x] `calculateShopManagerIncentive` computes all 9 components + TOTAL
- [x] QGA Bonus: 5000/3000/1500 based on criteria when qgaAbove90=true
- [x] QGA SIM Commission: count×1.5/count×1/0 based on criteria when qgaAbove90=true
- [x] EVD Bonus: 3000/2000/0 based on criteria when evdAbove100AndReconciled=true
- [x] BA/Site Bonus: 4000/2000/0 based on criteria when baSite=true
- [x] M-PESA Commission: float×2%/float×2%/0 when mpesaTargetAndReconciled=true
- [x] DSA Achievement Bonus: 2000/1500/1000/0 based on dsaAirtimePercent thresholds (>=90/>=80/>=60/<60)
- [x] QO Target Bonus: 4000/0 based on qgaAbove90
- [x] EBU Activation Bonus: 3000/1500/500 when ebuRevenueMade && ebuAverageTopupAbove500
- [x] EBU Revenue Share: 25%/15%/0 based on ebuFirstMonthLfRevenue (>10000/>5000)
- [x] AT_RISK: all 9 components = 0 with note
- [x] `calculateAllShopManagerIncentives` batch orchestrates per-period calculation
- [x] `sendIncentivesToPayrollInputs` uses SKIP_EXISTING mode only

## API Routes

### Period Routes (5)
- [x] GET /periods — list with pagination
- [x] POST /periods — create with Zod validation
- [x] GET /periods/[id] — detail
- [x] PATCH /periods/[id] — update
- [x] POST /periods/[id]/open — DRAFT → OPEN
- [x] POST /periods/[id]/cancel — any status → CANCELLED

### Input Routes (3)
- [x] GET /periods/[id]/inputs — list with scope filter + department sections
- [x] POST /periods/[id]/inputs — create (department-scoped, At-risk lock)
- [x] GET /periods/[id]/inputs/[inputId] — detail
- [x] PATCH /periods/[id]/inputs/[inputId] — update (department-scoped, At-risk lock)

### Calculation/Export/Payroll (3)
- [x] POST /periods/[id]/calculate — trigger calculation → CALCULATED
- [x] GET /periods/[id]/export — CSV export with component columns
- [x] POST /periods/[id]/send-to-payroll-inputs — handoff to payroll inputs (SKIP_EXISTING)

### Dashboard (1)
- [x] GET /periods/[id]/dashboard — stats + component totals

## RBAC (10 incentive permissions)
- [x] SUPER_ADMIN has all 10
- [x] HR_ADMIN has all 10
- [x] SALES_HEAD has view/createPeriod/updatePeriod/inputSales/inputAll/calculate/export/sendToPayroll
- [x] DISTRIBUTION_HEAD has view/inputDistribution/export
- [x] EBU_HEAD has view/inputEbu/export
- [x] ASM has view/export
- [x] SHOP_MANAGER has view
- [x] FINANCE_DIRECTOR has view/calculate/export/sendToPayroll
- [x] FINANCE_PAYROLL has view/export/sendToPayroll
- [x] AUDITOR has view/export
- [x] EMPLOYEE has none

## Department Input Ownership
- [x] Sales Head can write: qgaAbove90, qgaQuantity, mmQoTargets, dsaAirtimePercent
- [x] Distribution Head can write: corridorStatus, evdAbove100AndReconciled, mpesaTargetAndReconciled, mpesaFloatSold, baSite
- [x] EBU Head can write: ebuTarget, ebuRevenueMade, ebuAverageTopupAbove500, ebuFirstMonthLfRevenue
- [x] inputAll permission can write everything
- [x] shopCriteria, shopManagerId, responsibleRemarks writable by anyone with any input permission

## Input Fields (config-driven per spec)
- [x] qgaAbove90: Boolean (Yes/No)
- [x] qgaQuantity: Int
- [x] mmQoTargets: Boolean (Yes/No)
- [x] dsaAirtimePercent: Decimal (%)
- [x] corridorStatus: Boolean (Yes/No)
- [x] evdAbove100AndReconciled: Boolean (Yes/No)
- [x] mpesaTargetAndReconciled: Boolean (Yes/No)
- [x] mpesaFloatSold: Decimal
- [x] baSite: Boolean (Yes/No)
- [x] ebuTarget: Decimal
- [x] ebuRevenueMade: Boolean (Yes/No)
- [x] ebuAverageTopupAbove500: Boolean (Yes/No)
- [x] ebuFirstMonthLfRevenue: Decimal
- [x] shopCriteria: ShopCriteria enum (Gold/Silver/Bronze/At-risk)
- [x] shopManagerId: String
- [x] responsibleRemarks: String

## At-Risk Behavior
- [x] PATCH input when shopCriteria=AT_RISK: only shopCriteria and responsibleRemarks can be changed
- [x] POST input when shopCriteria=AT_RISK: allowed (stores the input)
- [x] Calculation: all 9 components = 0
- [x] Note: "At-risk shop: all incentive components are zero."

## UI Pages (5, no review or import pages)
- [x] `/shop-manager-incentives` — list with status badges, actions, filters
- [x] `/shop-manager-incentives/new` — create form with payroll period select
- [x] `/shop-manager-incentives/[id]` — dashboard with metric cards, action buttons
- [x] `/shop-manager-incentives/[id]/inputs` — Google Sheet-style table, department sections, At-risk grey-out
- [x] `/shop-manager-incentives/[id]/calculations` — calculation breakdown with expandable components
- [x] No `/shop-manager-incentives/[id]/review` page
- [x] No `/shop-manager-incentives/[id]/import` page

## Tests (180+ covering all scenarios)
- [x] 110 permission assertion checks across all 10 permissions and 14 roles
- [x] 4 shop criteria validation (Gold/Silver/Bronze/At-risk accepted, Unassigned blocked)
- [x] 5 incentive period CRUD + lifecycle state transitions
- [x] 5 input CRUD (create with auto-population, update, department-scoped, At-risk lock)
- [x] 49 calculation rule assertions (QGA ×4, QGA SIM ×3, EVD ×4, BA ×4, M-PESA ×2, DSA ×4, QO ×2, EBU Activation ×4, EBU Rev Share ×3, AT_RISK ×2, total ×3, component sum ×16)
- [x] 8 workflow assertions (full lifecycle: create → open → input → calculate → export → send-to-payroll)
- [x] 2 regression checks
- [x] Cleanup succeeds without errors

## Quality Gates
- [x] `tsc --noEmit` passes (0 errors)
- [x] `npm run lint` passes (0 errors, warnings only)
- [x] `npm run build` passes (0 errors, 68 routes + pages)
- [x] `npm run test:phase4c2` passes (180+ tests, 0 failed)

## Critical Fixes (Phase 4C.2)
- [x] Only total incentive is payable (`SHOP_MANAGER_TOTAL_INCENTIVE` component)
- [x] Individual component calculations are audit details only (not sent to payroll)
- [x] Calculation is atomic (all-or-nothing transaction — all shops succeed or none)
- [x] Payroll handoff is atomic (all-or-nothing transaction — all records created or none)
- [x] Department input ownership enforced on both POST and PATCH
- [x] Scoped users (ASM, SHOP_MANAGER) see only their shops in all endpoints
- [x] Input changes after calculation trigger recalculation requirement
- [x] Legacy component payroll input types (`SHOP_MANAGER_QGA_BONUS`, etc.) marked inactive
- [x] DELETE `/periods/[id]/inputs/[inputId]` route added
- [x] GET `/periods/[id]/calculations` endpoint added
- [x] 12 API end-to-end test suites added (period lifecycle, input CRUD, calculation, payroll handoff, scope enforcement, department ownership, at-risk lock, recalculation, delete, export, permissions, regression)
- [x] GitHub CI workflow added (`.github/workflows/ci.yml` — lint, typecheck, build, test)
