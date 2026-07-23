# UAT Checklist

## Employee Registry

- [ ] Create employee with all required fields
- [ ] Edit employee basic salary
- [ ] Assign payroll group
- [ ] Set payment method (BANK/MPESA/CASH)
- [ ] Enter tax ID and pension ID
- [ ] Import employees via CSV
- [ ] Verify employee list pagination and search

## Payroll Period

- [ ] Create a new payroll period (month + year)
- [ ] Verify duplicate period prevention
- [ ] Snapshot active employees
- [ ] Confirm re-snapshot warning appears when rows exist
- [ ] Verify excluded employees (RESIGNED/TERMINATED/EXITED/SUSPENDED)

## Row Editing

- [ ] Edit working days
- [ ] Edit commission and overtime separately
- [ ] Edit allowance and other deduction
- [ ] Verify validation resets to PENDING after edit
- [ ] Verify edit rejected when period is READY
- [ ] Verify edit rejected when period is LOCKED

## Calculation

- [ ] Run calculate
- [ ] Verify monthly salary = Basic/30 × WorkingDays
- [ ] Verify gross = monthly + commission + overtime + KPI
- [ ] Verify income tax against progressive brackets
- [ ] Verify employee pension (7%) when eligible
- [ ] Verify employer pension (11%) when eligible
- [ ] Verify zero pension in first 2 months
- [ ] Verify net pay formula

## Validation

- [ ] Run validate
- [ ] Verify missing employee code/name blocked
- [ ] Verify missing payroll group blocked
- [ ] Verify missing hire date blocked
- [ ] Verify zero basic salary blocked
- [ ] Verify invalid working days blocked
- [ ] Verify uncalculated salary blocked
- [ ] Verify pension ID warning vs blocker rules
- [ ] Verify tax ID warning
- [ ] Verify payment method warnings

## Lifecycle

- [ ] Mark READY succeeds when no blockers
- [ ] Verify READY rejected with PENDING rows
- [ ] Verify READY rejected with ERROR rows
- [ ] Verify READY rejected with missing active employees

## Excel Export

- [ ] Generate Excel when READY
- [ ] Verify export contains 11 payroll worksheets
- [ ] Verify employees grouped by payroll group
- [ ] Verify Performance Summary and Overtime sheets
- [ ] Verify column headers A-S
- [ ] Verify totals row
- [ ] Download export file
- [ ] Regenerate export

## Lock

- [ ] Verify lock rejected without export
- [ ] Verify lock rejected with mismatched row count
- [ ] Verify lock rejected with mismatched totals
- [ ] Lock period
- [ ] Verify locked rows cannot be edited
- [ ] Verify locked calculation disabled
- [ ] Verify locked re-snapshot disabled
- [ ] Verify export still works when locked

## Reopen

- [ ] Verify reopen requires non-empty reason
- [ ] Reopen with reason
- [ ] Verify status returns to DRAFT
- [ ] Verify rows reset to PENDING
- [ ] Verify historical exports still visible

## Audit

- [ ] Verify snapshot logged
- [ ] Verify row edit logged with old/new values
- [ ] Verify calculation logged
- [ ] Verify validation logged
- [ ] Verify READY transition logged
- [ ] Verify export creation logged
- [ ] Verify export download logged
- [ ] Verify lock logged
- [ ] Verify reopen logged

## Security

- [ ] Verify export download verifies period ownership
- [ ] Verify path traversal prevented
- [ ] Verify PAYROLL_EXPORT_DIR respected
- [ ] Verify unauthorized access rejected
