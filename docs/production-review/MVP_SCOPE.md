# MVP Scope

The Minimum Viable Product covers two core workflows:

1. **Employee Registry** — Create, edit, import, and manage employee records with basic salary, payroll group assignment, and payroll profile (payment method, bank/MPESA details, tax ID, pension ID).

2. **Monthly Payroll Excel Generation** — Create a payroll period, snapshot active employees, edit variable inputs, calculate salaries using workbook-defined formulas, validate, mark ready, generate an 11-sheet payroll workbook matching the company's exact format, lock, and reopen for corrections.

## In Scope

- Employee CRUD with status tracking (DRAFT → ACTIVE/ON_PROBATION → etc.)
- Employee import via CSV
- Payroll group assignment (11 groups matching worksheet names)
- Payroll profile (payment method, bank, MPESA, tax ID, pension ID)
- Payroll period lifecycle: DRAFT → READY → LOCKED (with reopen)
- Snapshot: captures active employees into payroll rows
- Edit: working days, commission, overtime, incentive, allowance, other deduction
- Calculate: monthly salary, gross, income tax (7 progressive brackets), pension (7%/11%), total deduction, net
- Validate: per-row status (VALID/WARNING/ERROR), missing fields, formula reconciliation
- Excel export: 11 payroll worksheets + Performance Summary + Overtime, template-based
- Export verification: worksheet count, employee assignment, totals reconciliation, SHA-256 checksum
- Lock/unlock lifecycle with export verification gates
- Audit logging for all lifecycle events
- Download with path traversal protection and PAYROLL_EXPORT_DIR support

## Out of Scope (Deferred)

- Payslip generation and publishing
- Bank integration / payment file generation
- M-PESA payment integration
- Electronic statutory filing (PAYE, pension)
- Attendance or leave integration
- Advanced KPI or commission automation
- Payment batch management
- Journal entries / accounting integration
- Employee self-service portal
