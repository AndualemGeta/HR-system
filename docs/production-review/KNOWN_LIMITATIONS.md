# Known Limitations (MVP)

The following features are explicitly out of scope for the MVP and deferred to future phases:

- No payslip generation or publishing
- No bank integration or payment file generation
- No M-PESA payment integration
- No electronic statutory filing (PAYE, pension)
- No attendance or leave integration
- No advanced KPI or commission automation
- Current tax formulas follow the supplied payroll workbook and require Finance policy confirmation
- No employee self-service portal
- No real-time dashboard or analytics
- No automated notifications or reminders
- No multi-currency support
- No historical trend reporting

## Technical Limitations

- The Excel template is loaded from `templates/payroll/Salary_June_2026_reference.xlsx`. If the template is missing, the generator falls back to creating a clean workbook without template styles.
- Export directory defaults to `uploads/payroll-exports/` unless `PAYROLL_EXPORT_DIR` env var is set.
- Row validation messages are stored as JSON in the database and not indexed for search.
- The MVP uses a simplified audit log (single AuditLog table) rather than per-entity audit tables.
