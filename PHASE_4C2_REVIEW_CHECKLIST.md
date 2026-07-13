# Phase 4C.2 Review Checklist — Shop Manager Incentive (Management Input Form Design)

## Schema & Data
- [ ] 4 incentive Prisma models exist: `ShopManagerIncentivePeriod`, `ShopManagerIncentiveInput`, `ShopManagerIncentiveCalculation`, `ShopManagerIncentiveInputConfig`
- [ ] No `ShopManagerIncentiveComponent` or `ShopManagerIncentiveIssue` models
- [ ] Enums: `IncentivePeriodStatus` has DRAFT/OPEN/CALCULATED/CANCELLED (no UNDER_REVIEW/APPROVED/LOCKED/READY_FOR_CALCULATION)
- [ ] AuditAction has: PERIOD_CREATE, PERIOD_UPDATE, PERIOD_OPEN, INPUT_CREATE, INPUT_UPDATE, CALCULATE, EXPORT, SEND_TO_PAYROLL (no review/approve/lock actions)
- [ ] `prisma db push --accept-data-loss` applies without conflicts
- [ ] 96 total permissions seeded (10 shopManagerIncentive.* keys)
- [ ] 14 roles seeded (DISTRIBUTION_HEAD, EBU_HEAD added)
- [ ] 15 ShopManagerIncentiveInputConfigs seeded (Sales/Distribution/EBU department ownership)
- [ ] Cleanup order handles all 3 incentive models (+ InputConfig)

## Calculation Engine (`src/lib/shop-manager-incentives.ts`)
- [ ] `validateShopCriteria` only accepts GOLD/SILVER/BRONZE/AT_RISK
- [ ] `calculateShopManagerIncentive` computes all 9 components + TOTAL
- [ ] QGA Bonus: 5000/3000/1500 based on criteria when qgaAbove90=true
- [ ] QGA SIM Commission: count×1.5/count×1/0 based on criteria when qgaAbove90=true
- [ ] EVD Bonus: 3000/2000/0 based on criteria when evdAbove100AndReconciled=true
- [ ] BA/Site Bonus: 4000/2000/0 based on criteria when baSite=true
- [ ] M-PESA Commission: float×2%/float×2%/0 when mpesaTargetAndReconciled=true
- [ ] DSA Achievement Bonus: 2000/1500/1000/0 based on dsaAirtimePercent thresholds (>=90/>=80/>=60/<60)
- [ ] QO Target Bonus: 4000/0 based on qgaAbove90
- [ ] EBU Activation Bonus: 3000/1500/500 when ebuRevenueMade && ebuAverageTopupAbove500
- [ ] EBU Revenue Share: 25%/15%/0 based on ebuFirstMonthLfRevenue (>10000/>5000)
- [ ] AT_RISK: all 9 components = 0 with note
- [ ] `calculateAllShopManagerIncentives` batch orchestrates per-period calculation
- [ ] `sendIncentivesToPayrollInputs` uses SKIP_EXISTING mode only

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
- [ ] SUPER_ADMIN has all 10
- [ ] HR_ADMIN has all 10
- [ ] SALES_HEAD has view/createPeriod/updatePeriod/inputSales/inputAll/calculate/export/sendToPayroll
- [ ] DISTRIBUTION_HEAD has view/inputDistribution/export
- [ ] EBU_HEAD has view/inputEbu/export
- [ ] ASM has view/export
- [ ] SHOP_MANAGER has view
- [ ] FINANCE_DIRECTOR has view/calculate/export/sendToPayroll
- [ ] FINANCE_PAYROLL has view/export/sendToPayroll
- [ ] AUDITOR has view/export
- [ ] EMPLOYEE has none

## Department Input Ownership
- [ ] Sales Head can write: qgaAbove90, qgaQuantity, mmQoTargets, dsaAirtimePercent
- [ ] Distribution Head can write: corridorStatus, evdAbove100AndReconciled, mpesaTargetAndReconciled, mpesaFloatSold, baSite
- [ ] EBU Head can write: ebuTarget, ebuRevenueMade, ebuAverageTopupAbove500, ebuFirstMonthLfRevenue
- [ ] inputAll permission can write everything
- [ ] shopCriteria, shopManagerId, responsibleRemarks writable by anyone with any input permission

## Input Fields (config-driven per spec)
- [ ] qgaAbove90: Boolean (Yes/No)
- [ ] qgaQuantity: Int
- [ ] mmQoTargets: Boolean (Yes/No)
- [ ] dsaAirtimePercent: Decimal (%)
- [ ] corridorStatus: Boolean (Yes/No)
- [ ] evdAbove100AndReconciled: Boolean (Yes/No)
- [ ] mpesaTargetAndReconciled: Boolean (Yes/No)
- [ ] mpesaFloatSold: Decimal
- [ ] baSite: Boolean (Yes/No)
- [ ] ebuTarget: Decimal
- [ ] ebuRevenueMade: Boolean (Yes/No)
- [ ] ebuAverageTopupAbove500: Boolean (Yes/No)
- [ ] ebuFirstMonthLfRevenue: Decimal
- [ ] shopCriteria: ShopCriteria enum (Gold/Silver/Bronze/At-risk)
- [ ] shopManagerId: String
- [ ] responsibleRemarks: String

## At-Risk Behavior
- [ ] PATCH input when shopCriteria=AT_RISK: only shopCriteria and responsibleRemarks can be changed
- [ ] POST input when shopCriteria=AT_RISK: allowed (stores the input)
- [ ] Calculation: all 9 components = 0
- [ ] Note: "At-risk shop: all incentive components are zero."

## UI Pages (5, no review or import pages)
- [ ] `/shop-manager-incentives` — list with status badges, actions, filters
- [ ] `/shop-manager-incentives/new` — create form with payroll period select
- [ ] `/shop-manager-incentives/[id]` — dashboard with metric cards, action buttons
- [ ] `/shop-manager-incentives/[id]/inputs` — Google Sheet-style table, department sections, At-risk grey-out
- [ ] `/shop-manager-incentives/[id]/calculations` — calculation breakdown with expandable components
- [ ] No `/shop-manager-incentives/[id]/review` page
- [ ] No `/shop-manager-incentives/[id]/import` page

## Tests (180+ covering all scenarios)
- [ ] 110 permission assertion checks across all 10 permissions and 14 roles
- [ ] 4 shop criteria validation (Gold/Silver/Bronze/At-risk accepted, Unassigned blocked)
- [ ] 5 incentive period CRUD + lifecycle state transitions
- [ ] 5 input CRUD (create with auto-population, update, department-scoped, At-risk lock)
- [ ] 49 calculation rule assertions (QGA ×4, QGA SIM ×3, EVD ×4, BA ×4, M-PESA ×2, DSA ×4, QO ×2, EBU Activation ×4, EBU Rev Share ×3, AT_RISK ×2, total ×3, component sum ×16)
- [ ] 8 workflow assertions (full lifecycle: create → open → input → calculate → export → send-to-payroll)
- [ ] 2 regression checks
- [ ] Cleanup succeeds without errors

## Quality Gates
- [ ] `tsc --noEmit` passes (0 errors)
- [ ] `npm run lint` passes (0 errors, warnings only)
- [ ] `npm run build` passes (0 errors, 68 routes + pages)
- [ ] `npm run test:phase4c2` passes (180+ tests, 0 failed)
