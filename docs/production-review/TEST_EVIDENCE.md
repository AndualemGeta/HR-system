# Test Evidence

## Test Suites

| Suite | Command | File |
|-------|---------|------|
| Unit Tests | `npm run test:mvp` | `src/test/mvp-payroll-tests.ts`, `src/test/mvp-employee-tests.ts` |
| E2E Tests | `npm run test:mvp-e2e` | `src/test/mvp-payroll-e2e.ts` |
| UI Tests | `npm run test:ui-e2e` | `src/test/ui/mvp-month-end-payroll.e2e.ts` |

## Unit Test Coverage

### Shared Module Formula Tests (`mvp-payroll-tests.ts`)

- Monthly = Basic/30 × WorkingDays
- Gross = Monthly + Commission + Overtime + KPI
- Commission/OT combined field
- All 7 income tax brackets
- Employee pension = 7% when eligible, 0 when not
- Employer pension = 11% when eligible, 0 when not
- Total deduction = Tax + Employee pension + Shortage/Loan
- Net = Gross − Total deduction + Transport allowance
- Transport allowance excluded from gross
- All results rounded to 2 decimals
- Pension eligibility: null, hire month, second month, third month, many months

### Persisted Row Tests

- Reconciled persisted row values against shared module (monthly, gross, tax, pensions, total deduction, net)
- Tolerance of ±1 for Decimal.js rounding

## E2E Test Coverage (`mvp-payroll-e2e.ts`)

Uses isolated fixtures: unique employee codes, unique emails, separate HR and Finance test users, unique payroll periods.

- Login through real login API
- Create payroll period
- Snapshot employees
- Edit working days, commission, overtime separately
- Calculate and verify persisted formulas
- Verify first-month pension = 0
- Verify second-month pension = 0
- Verify third-month+ pension = 7% and 11%
- Validate rows
- Prove READY rejects PENDING rows
- Prove READY rejects ERROR rows
- Mark READY after all blockers resolved
- Generate Excel (HTTP 200)
- Verify export record
- Download export
- Lock period
- Prove locked rows cannot be edited
- Prove locked calculation rejected
- Prove locked re-snapshot rejected
- Prove export remains available when locked
- Reopen with reason (rejects empty reason)
- Prove rows reset to PENDING after reopen
- Prove historical exports remain after reopen
- Cleanup only test-created data

## Playwright UI Test (`mvp-month-end-payroll.e2e.ts`)

- Login
- Open employee list and payroll pages
- Create/find payroll period
- Snapshot employees
- Edit variable inputs
- Calculate
- Validate
- Mark READY
- Generate Excel
- Lock
- View export history
