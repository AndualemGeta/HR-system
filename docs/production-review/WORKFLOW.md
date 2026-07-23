# Payroll Lifecycle Workflow

## States

```
DRAFT → READY → LOCKED
  ↑                    │
  └──── Reopen ────────┘
```

## Step-by-step

1. **Create Period** — POST /api/payroll with month/year. Period starts DRAFT.

2. **Snapshot** — POST /api/payroll/:id/snapshot. Captures all ACTIVE/ON_PROBATION employees (excludes RESIGNED/TERMINATED/EXITED/SUSPENDED). Creates a row per employee with basic salary, payroll group, hire date, pension eligibility, payment info, snapshot JSON.

3. **Edit Rows** — PUT /api/payroll/:id/rows. Edit working days, commission, overtime, incentive, allowance, other deduction, notes, payment info. Each edit resets validationStatus to PENDING. Edits rejected when READY or LOCKED.

4. **Calculate** — POST /api/payroll/:id/calculate. Uses shared module (Decimal.js) to compute monthly salary, gross, income tax, pension, total deduction, net. Blocked when LOCKED.

5. **Validate** — POST /api/payroll/:id/validate. Checks all required fields, formula reconciliation, pension ID rules, payment info. Sets each row to VALID/WARNING/ERROR.

6. **Ready** — POST /api/payroll/:id/ready. Gates: all rows calculated, no PENDING rows, no ERROR rows, all payroll groups assigned, no missing active employees. Transitions to READY.

7. **Generate Excel** — POST /api/payroll/:id/generate-excel. Requires READY or LOCKED. Produces 11 payroll worksheets + summary + overtime. Verifies output: worksheet count, employee assignment, totals reconciliation, no external links. Creates MvpPayrollExport record. Blocked when ERROR or PENDING rows exist.

8. **Lock** — POST /api/payroll/:id/lock. Requires READY + at least one successful export + export row count matches + export totals match payroll totals. Transitions to LOCKED. Rows become immutable, calculation disabled, re-snapshot disabled, export remains available.

9. **Reopen** — POST /api/payroll/:id/reopen. Requires LOCKED + non-empty reason. Returns to DRAFT. Resets all row validation to PENDING. Keeps historical export records.

## Gates Summary

| Action     | DRAFT | READY | LOCKED |
|------------|-------|-------|--------|
| Snapshot   | ✓     | ✗     | ✗      |
| Edit Rows  | ✓     | ✗     | ✗      |
| Calculate  | ✓     | ✓     | ✗      |
| Validate   | ✓     | ✓     | ✓      |
| Ready      | ✓     | —     | —      |
| Export     | ✗     | ✓     | ✓      |
| Lock       | ✗     | ✓     | —      |
| Reopen     | ✗     | ✗     | ✓      |
| Download   | ✓     | ✓     | ✓      |
