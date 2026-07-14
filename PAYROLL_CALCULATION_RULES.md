# Payroll Calculation Rules

## Calculation Order

1. **Basic Salary** (prorated if applicable)
2. **Earning Components** (allowances, commissions, bonuses, incentives)
3. **Deduction Components** (manual deductions, loan deductions)
4. **Gross Salary** = sum of all earning gross amounts
5. **Taxable Income** = gross taxable earnings − pre-tax deductions
6. **PAYE Tax** = taxable income × bracket rate / 100 − bracket deduction (min 0)
7. **Pension Base** = determined by pension rule base type
8. **Employee Pension** = pension base × employee rate / 100
9. **Employer Pension** = pension base × employer rate / 100
10. **Total Deductions** = employee pension + PAYE + pre-tax deductions + post-tax deductions
11. **Net Salary** = gross salary − total deductions
12. **Employer Total Cost** = gross salary + employer pension

## Salary Source Priority

1. `EmployeeSalary` record (latest effective ≤ period end)
2. `Employee.basicSalary` field (must have salaryEffectiveDate ≤ period end)
3. Blocked: `MISSING_EFFECTIVE_BASIC_SALARY`

## Component Treatment

### Earning Components
- Increase gross salary
- Taxable/non-taxable split based on `taxablePercent`
- Pensionable portion based on `isPensionable` + `pensionablePercent`
- Employer cost if `affectsEmployerCost = true`

### Deduction Components
- Gross amount = 0 (do not increase gross salary)
- Deduction amount reduces net salary
- Pre-tax deductions reduce taxable income
- Post-tax deductions reduce net salary directly

## PAYE Schedule Validation

- `minIncome` inclusive, `maxIncome` exclusive
- Highest bracket must be open-ended (`maxIncome = null`)
- No gaps between consecutive brackets
- No overlaps between consecutive brackets
- No boundary conflicts (current max must equal next min)
- Tax rate: 0–100
- Deduction amount: ≥ 0

## Pension Rule Selection

1. Load approved, active, non-sample, effective rules
2. Score by specificity: role match (+10), employment type match (+5)
3. Highest priority within same score tier wins
4. Equal priority + equal score = `AMBIGUOUS_PENSION_RULE` (blocked)
5. Not found = `MISSING_PENSION_RULE` (blocked)

## Proration Methods

- **NONE**: Full salary
- **CALENDAR_DAYS**: `salary × eligibleDays / periodDays`
- **WORKING_DAYS**: `salary × daysPresent / configuredWorkingDays`
- **MANUAL**: Requires accepted + locked manual input

## Rounding

All monetary values rounded to 2 decimal places: `Math.round(value * 100) / 100`

## Negative Net Salary

Net salary can be calculated as negative. When negative:
- Preview: shows the negative value
- Final: blocked with `NEGATIVE_NET_SALARY` — batch is not created
