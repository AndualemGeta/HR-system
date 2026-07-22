# Leapfrog Payroll Workbook — MVP Analysis

Source workbook: `Salary For The Month Of June 2026 G.C Sene 2018 E.C(1).xlsx`

## Workbook structure

The workbook contains 13 worksheets:

1. HO,A.A SHOP
2. DSA
3. EBU Department
4. Aleletu
5. Chacha
6. Legetafo
7. Hmariam
8. Sirti
9. Mendida
10. Sendafa
11. Sheno
12. Performance Summary
13. Overtime

The 11 payroll worksheets contain approximately 212 employee payroll rows. `Performance Summary` and `Overtime` are helper/input worksheets.

## Main payroll columns

| Column | Workbook heading | MVP system field |
|---|---|---|
| A | No. | Row number |
| B | Name of Employees | Employee name |
| C | Position | Role/position |
| D | Shop Name / Work Place | Department/shop/location |
| E | Working days | Working days |
| F | Basic Salary | Basic salary |
| G | Monthly Salary | Prorated monthly salary |
| H | Commiss. / OT | Commission/overtime amount |
| I | KPI | KPI/incentive amount |
| J | Gross Salary | Gross salary |
| K | Taxable Income | Taxable income |
| L | Income Tax | PAYE/income tax |
| M | Pension 7% | Employee pension |
| N | Pension 11% | Employer pension |
| O | Shortage / Loan | Shortage/loan deduction |
| P | Total Deduction | Total employee deduction |
| Q | Transport & Other Allowance | Transport/other allowance |
| R | Net Pay | Net salary |
| S | Sign | Signature/reconciliation note |

## Existing calculation rules

The workbook mainly uses these formulas:

- Monthly salary = Basic salary / 30 × Working days
- Gross salary = Monthly salary + Commission/OT + KPI
- Taxable income = Gross salary
- Income tax:
  - Up to 2,000: 0
  - 2,000.01–4,000: 15% − 300
  - 4,000.01–7,000: 20% − 500
  - 7,000.01–10,000: 25% − 850
  - 10,000.01–14,000: 30% − 1,350
  - Above 14,000: 35% − 2,050
- Employee pension = Basic salary × 7%, where applicable
- Employer pension = Basic salary × 11%, where applicable
- Total deduction = Income tax + Employee pension + Shortage/Loan
- Net pay = Gross salary − Total deduction + Transport/Other allowance

Overtime helper formula:

- Overtime amount = Basic salary / 208 × Total weighted overtime hours

## Cached workbook totals

Across the 11 payroll worksheets:

- Employees: approximately 212
- Basic salary: ETB 2,662,789.62
- Monthly salary: ETB 2,572,811.43
- Commission/OT: ETB 528,827.57
- KPI: ETB 337,111.53
- Gross salary: ETB 3,438,750.53
- Income tax: ETB 842,134.75
- Employee pension: ETB 154,268.85
- Employer pension: ETB 229,246.12
- Shortage/loan: ETB 17,500.00
- Total deduction: ETB 1,012,913.05
- Transport/other allowance: ETB 257,086.67
- Net pay: ETB 2,682,924.14

## Workbook risks the MVP should remove

1. Sheet titles use inconsistent periods: June/Sene, Megabit, and March.
2. Two formulas contain external workbook references:
   - `[1]Shop Mgr KPI`
   - `[2]Overtime`
3. Pension formulas are not consistent across all rows; some are blank or use monthly salary instead of basic salary.
4. KPI, commission, overtime and allowances are frequently hardcoded or manually composed.
5. Column S is sometimes used for reconciliation calculations instead of only signature.
6. The same formulas are copied across many sheets, increasing manual-error risk.
7. Employee names, shop names and positions are manually repeated every month.
8. Historical workbook totals depend on cached Excel values and external-link availability.

## Recommended production MVP

The application should use one central employee master and one monthly payroll table. The Excel exporter should split payroll rows into the same 11 payroll sheets and reproduce the existing workbook format.

### Employee master

- Employee ID
- Full name
- Position
- Department/shop/location
- Employment status
- Basic salary
- Salary effective date
- Pension applicable flag
- Tax applicable flag
- Payment method and payment details

### Monthly payroll inputs

- Working days
- Commission
- Overtime
- KPI/incentive
- Shortage/loan
- Transport/other allowance
- Notes

### Calculated fields

- Monthly salary
- Gross salary
- Taxable income
- Income tax
- Employee pension
- Employer pension
- Total deduction
- Net pay

### Required output

- Preserve the current 11 payroll sheet names and layouts.
- Preserve `Performance Summary` and `Overtime` as optional helper sheets.
- Generate the period title centrally so every sheet uses the same month.
- Remove all external workbook links.
- Preserve totals, signatures, merged cells, widths, print setup and number formatting.
- Add export reconciliation: employee count and all totals must match the application payroll period.
- Lock the period after approved export so historical data cannot change.

## MVP completion condition

The system is ready for user acceptance only when it generates a workbook that matches this source workbook's sheet structure, employee count, formulas/values, formatting and totals for a selected historical month.
