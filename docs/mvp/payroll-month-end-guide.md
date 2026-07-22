# Month-End Payroll Procedure

## Step 1 — Create Period
- Go to Payroll > New Period
- Select the month/year being processed
- Verify the pay date

## Step 2 — Snapshot Employees
- Open the period
- Click "Snapshot Active Employees"
- Verify all expected employees are present

## Step 3 — Enter Monthly Values
- For each employee, enter:
  - Allowances (if applicable)
  - Overtime (if applicable)
  - Incentives (if applicable)
  - Commission (if applicable)
  - Pension contribution
  - Income tax
  - Other deductions
- Use bulk update for common values
- Verify payment method for each employee

## Step 4 — Calculate
- Click "Calculate Gross/Net"
- Verify gross salaries look reasonable
- Verify net salaries are positive

## Step 5 — Validate
- Click "Validate Rows"
- Check blocker count is 0
- Review warnings (non-blocking)
- Fix any errors found

## Step 6 — Mark Ready
- Click "Mark Ready"
- Period moves to READY status

## Step 7 — Export
- Click "Export Excel"
- The workbook is generated
- Download and verify the file
- Check row count matches employee count
- Check totals reconcile

## Step 8 — Lock
- Click "Lock Period"
- Period is now immutable
- Export records remain available for download

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Wrong employees in period | Re-snapshot (draft periods only) |
| Calculation errors | Verify all input values are positive |
| Validation blockers | Fix each error and re-validate |
| Missing bank details | Update employee payroll profile |
| Export won't generate | Ensure period is READY or LOCKED |

## Reopening

If corrections are needed after locking:
1. Click "Reopen"
2. Provide a clear reason
3. Make corrections
4. Re-validate and re-export
