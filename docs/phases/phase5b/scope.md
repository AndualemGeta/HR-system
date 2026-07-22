# Phase 5B — Payroll Finalization, Payslips, Payment Exports and Statutory Reporting

## Scope

Phase 5B implements the post-approval payroll workflow using an approved and immutable Phase 5A PayrollPreparationBatch as the sole source of payroll amounts.

### In Scope

1. Phase 5A carryover stabilization (P5B-001 through P5B-010)
2. Payroll finalization and immutable output snapshots
3. Employee payslip generation and secure access
4. Bank and M-PESA payment batches and exports
5. PAYE and pension statutory reports
6. Payroll register and accounting journal export
7. Payment reconciliation and controlled status updates
8. Maker-checker approval for finalization, payments, and reports
9. Audit history and export integrity
10. Complete API, UI, E2E and CI verification

### Out of Scope

- Direct bank API integration
- Direct M-PESA disbursement API integration
- Direct Ethiopian government e-filing (ERCA, Ministry, Pension)
- Attendance or leave management
- General KPI engine redesign
- Changes to approved payroll calculation results
- Phase 6 employee self-service (beyond secure payslip access)

### Design Principles

1. Immutability — approved output packages, payslips, and reports are immutable
2. Separation of duties — maker-checker enforced at every approval gate
3. Auditability — every generation, review, approval, download, and filing is audited
4. Reconciliation — every export and report total is verified against its source
5. Idempotency — repeated generation requests do not duplicate data
6. Decimal safety — all monetary values use Decimal.js via existing money utilities
