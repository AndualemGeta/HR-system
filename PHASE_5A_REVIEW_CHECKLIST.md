# Leapfrog HR Management System

## Phase 5A — Payroll Calculation Engine

### Overview

Phase 5A implements the payroll calculation engine, statutory rules configuration, review/approval workflow, and supporting user interfaces.

**Status:** Ready for Phase 5A user review (not production-ready)

### Key Concepts

- **PayComponent**: Every payroll amount must be connected to a PayComponent. Components determine earning/deduction type, taxable treatment, pensionable treatment, gross/net/employer-cost impact.
- **PayrollInput**: Employee-entered values for variable pay elements (allowances, commissions, KPIs). Must be accepted and locked before calculation.
- **PayrollPreparationBatch**: Versioned calculation result. Each recalculation creates a new version. Approved batches are immutable.
- **PayrollCalculationLine**: Line-by-line audit trail showing every amount, its source, and how it was calculated.

### Salary Source Priority

1. `EmployeeSalary` record (latest effective before period end)
2. `Employee.basicSalary` field (if salary effective date is before period end)
3. Blocked (`MISSING_EFFECTIVE_BASIC_SALARY`)

### Input Readiness

Per-employee readiness checks:

- Required `PayrollInputRequirement` records are matched by employee category, role, department, region, area, shop, and employment type
- Each applicable requirement must have an accepted+locked input OR an active waiver
- Severity: `BLOCKER` (prevents calculation) or `WARNING` (allows calculation with notice)

### Component Mapping

Every `PayrollInputType` must be linked to a `PayComponent` via `payComponentId`. The component's configuration determines:

| Property | Effect |
|----------|--------|
| `taxTreatment` | Must not be `UNKNOWN` |
| `taxablePercent` | 0–100, determines taxable portion |
| `isPensionable` | Whether amount feeds pension base |
| `pensionablePercent` | 0–100, determines pensionable portion |
| `affectsGross` | Whether amount increases gross salary |
| `affectsNet` | Whether amount affects net salary |
| `affectsEmployerCost` | Whether amount increases employer cost |
| `isEarning` / `isDeduction` | Earning = increases gross, Deduction = reduces net |

### Tax Treatment

Supported: `TAXABLE`, `NON_TAXABLE`, `UNKNOWN`

`UNKNOWN` treatment **blocks calculation**. Finance must explicitly configure and approve treatment before payroll calculation can include a component.

### PAYE Schedule Boundaries

- `minIncome` inclusive, `maxIncome` exclusive
- Highest bracket: `maxIncome = null` (open-ended)
- No overlaps, no gaps
- Entire schedule must be validated before any bracket can be approved
- Schedule code groups brackets into a complete set

### Pension Rule Selection

Rules scored by specificity:
- Role match = +10
- Employment type match = +5
- Higher priority wins
- Equal priority ambiguity = `AMBIGUOUS_PENSION_RULE` blocker

### Deductions

- Employee pension (statutory)
- Employer pension (statutory, does not reduce net salary)
- PAYE tax (calculated on taxable income after pre-tax deductions)
- Pre-tax deductions (reduce taxable income)
- Post-tax deductions (reduce net salary)

### Proration

Methods: `NONE`, `CALENDAR_DAYS`, `WORKING_DAYS`, `MANUAL`

Requires explicit policy configuration.

### Batch Versioning

- First calculation: version 1
- Recalculation: `(latestBatch?.version ?? 0) + 1`
- Previous non-cancelled batch superseded (CANCELLED + SUPERSEDED)

### Workflow

```
DRAFT period → OPEN_FOR_INPUT → INPUT_COLLECTION_CLOSED
→ READY_FOR_CALCULATION → [calculate] → READY_FOR_REVIEW
→ [start review] → REVIEW_IN_PROGRESS → [validate] → VALIDATED
→ [approve] → APPROVED
↓ [return] → OPEN_FOR_INPUT or READY_FOR_CALCULATION
↓ [reopen] → OPEN_FOR_INPUT or READY_FOR_CALCULATION
```

### Known Limitations

- Transport, KPI and Sales Commission are defined pay types but are **not automatically assigned** to all employees
- Existing DSA rules are **sample draft configuration only**
- Statutory schedules require independent Finance verification before approval
- Phase 5A does **not** create payslips, bank files, M-PESA files, or tax submissions
- SHOP_MANAGER_INCENTIVE has `UNKNOWN` tax treatment — blocks calculation until configured
- Sample PAYE brackets and pension rules must be approved by Finance before use

### Test Commands

```bash
npm run test:phase5a          # Unit tests (40)
npm run test:phase5a-e2e      # E2E tests (15)
npm test                       # All tests including Phase 5A
```
