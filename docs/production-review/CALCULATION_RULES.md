# Payroll Calculation Rules

All calculations use Decimal.js via the shared module at `src/lib/payroll/mvp-calculations.ts`.

## Formulas

```
Monthly Salary = Basic / 30 × Working Days

Commission/OT (combined) = Commission + Overtime

Gross Salary = Monthly Salary + Commission + Overtime + KPI

Taxable Income = Gross Salary

Income Tax (progressive brackets, monthly):
  ≤ 2000        → 0
  2001 – 4000   → Taxable × 15% − 300
  4001 – 7000   → Taxable × 20% − 500
  7001 – 10000  → Taxable × 25% − 850
  10001 – 14000 → Taxable × 30% − 1350
  > 14000       → Taxable × 35% − 2050

Employee Pension = Basic × 7% (if pensionEligible, else 0)
Employer Pension = Basic × 11% (if pensionEligible, else 0)

Total Deduction = Income Tax + Employee Pension + Shortage/Loan

Net Pay = Gross Salary − Total Deduction + Transport & Other Allowance
```

## Pension Eligibility

- Employee is pension-eligible starting from the 3rd calendar month after hire date.
- Hire month + next month = ineligible (pension = 0).
- From the 3rd month onward, employee pension = 7% of basic, employer pension = 11% of basic.
- Computed by `computePensionEligible(hireDate, periodStart)` in the shared module.

## Notes

- Transport allowance is excluded from gross salary and added to net pay.
- All monetary values are rounded to 2 decimal places.
- The shared module is used by calculate route, validate route, Excel export, and unit tests (no formula duplication).
