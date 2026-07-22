# MVP Acceptance Matrix

## Employee Management

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| E-01 | Create employee with personal details | ✓ | First name, last name, email, phone, gender, DOB |
| E-02 | Create employee with employment details | ✓ | Department, role, location, manager, employment type, status |
| E-03 | Create employee with payroll details | ✓ | Basic salary, payment method, bank, M-PESA, tax ID, pension ID |
| E-04 | Duplicate employee detection | ✓ | By email or employee ID |
| E-05 | Edit employee | ✓ | All sections editable |
| E-06 | Employee status history | ✓ | Tracked in EmployeeStatusHistory |
| E-07 | Salary history | ✓ | Tracked in EmployeeSalary |
| E-08 | Employee import (Excel/CSV) | ✓ | Via ImportSession |
| E-09 | Employee export (Excel/CSV) | ✓ | Via employees page |
| E-10 | Audit logging for employee changes | ✓ | Via AuditLog |

## Payroll Period

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| P-01 | Create monthly payroll period | ✓ | One period per month enforced |
| P-02 | Snapshot active employees | ✓ | Active + OnProbation employees copied to PayrollRow |
| P-03 | Edit monthly payroll values | ✓ | Inline editable table |
| P-04 | Row validation | ✓ | Blocker/warning counts per row |
| P-05 | Mark period READY | ✓ | Status change with validation |
| P-06 | Generate payroll Excel | ✓ | Template-based generation |
| P-07 | Lock period | ✓ | Immutable after lock |
| P-08 | Reopen period with reason | ✓ | Audited, permission required |
| P-09 | Historical immutability | ✓ | Locked rows cannot be edited |

## Payroll Calculations

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| C-01 | Gross = Basic + Allowance + Overtime + Incentive + Commission | ✓ | Decimal.js |
| C-02 | TotalDeductions = Pension + Tax + Other | ✓ | |
| C-03 | Net = Gross - TotalDeductions | ✓ | |
| C-04 | Consistent rounding | ✓ | Round half-up, 2 decimals |
| C-05 | Manual override with reason | ✓ | Recorded in notes |

## Payroll Export

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| X-01 | Excel workbook generated | ✓ | Uses exceljs |
| X-02 | Sheet names preserved | ✓ | Matches company template |
| X-03 | Column order preserved | ✓ | |
| X-04 | Headers preserved | ✓ | |
| X-05 | Number formats preserved | ✓ | |
| X-06 | Totals validated | ✓ | Row count, amounts reconciled |
| X-07 | Template version recorded | ✓ | |
| X-08 | Export checksum stored | ✓ | SHA-256 |
| X-09 | No silent omissions | ✓ | Rows verified against export |

## Validation

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| V-01 | Employee ID check | ✓ | |
| V-02 | Employee name check | ✓ | |
| V-03 | Active status check | ✓ | |
| V-04 | Payment method check | ✓ | |
| V-05 | Bank account when BANK | ✓ | |
| V-06 | M-PESA number when MPESA | ✓ | |
| V-07 | Tax ID check | ✓ | |
| V-08 | Pension ID check | ✓ | |
| V-09 | No negative values | ✓ | Unless permitted |
| V-10 | Gross reconciles | ✓ | |
| V-11 | Deductions reconcile | ✓ | |
| V-12 | Net salary reconciles | ✓ | |
| V-13 | No duplicate employee | ✓ | |
| V-14 | No missing employee | ✓ | |
| V-15 | Total rows = export rows | ✓ | |

## Security

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| S-01 | Authentication required | ✓ | JWT-based |
| S-02 | Role-based access control | ✓ | 4 roles |
| S-03 | Salary fields permission-protected | ✓ | |
| S-04 | Payment accounts masked | ✓ | Shows last 4 digits |
| S-05 | Audit log of all changes | ✓ | |
| S-06 | HTTP-only cookies | ✓ | |
| S-07 | Environment validation | ✓ | |

## Production

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| PR-01 | PostgreSQL database | ✓ | |
| PR-02 | Prisma migrate deploy | ✓ | No db push in production |
| PR-03 | Secure AUTH_SECRET | ✓ | |
| PR-04 | HTTPS | ✓ | |
| PR-05 | Backup procedure documented | ✓ | |
| PR-06 | Restore procedure documented | ✓ | |
| PR-07 | Application logging | ✓ | |
| PR-08 | Error handling | ✓ | |
| PR-09 | Locked payroll immutability | ✓ | |
