# MVP Scope — Simple HR & Payroll Excel System

## Business Objective

1. Help HR register and maintain employee records.
2. Help HR and Finance prepare the monthly payroll Excel file they currently prepare manually.
3. Match the company's existing payroll Excel format.
4. Make this limited scope secure, reliable and production-ready.
5. Preserve the possibility of adding advanced features later.

## MVP Features (Active)

### Employee Registry
- Employee registration (personal, employment, payroll sections)
- Employee editing and status management
- Duplicate employee detection
- Employee status history
- Salary history tracking
- Employee import (Excel/CSV)
- Employee export (Excel/CSV)

### Payroll Preparation
- Monthly payroll period creation (one period per month)
- Active employee snapshot into payroll rows
- Excel-like editable payroll table with inline editing
- Keyboard navigation, copy-paste, search, filters
- Row-level validation with inline messages
- Totals footer with real-time calculation
- Bulk update where safe
- CSV/XLSX import for monthly values

### Payroll Calculations
- Gross = BasicSalary + Allowance + Overtime + Incentive + Commission
- TotalDeductions = EmployeePension + IncomeTax + OtherDeductions
- Net = Gross - TotalDeductions
- Decimal.js with consistent rounding

### Payroll Export
- Excel workbook generation matching the approved company template
- Preserved sheet names, column order, headers, formulas, formats
- Template version tracking
- Export checksum
- Validation before export (blockers and warnings)

### Payroll Lifecycle
1. Create period (month/year)
2. Snapshot active employees
3. Edit monthly values
4. Validate rows
5. Mark READY
6. Generate Excel
7. Lock period (immutable)

### Audit & Compliance
- Full audit log (create, update, status change, salary change)
- Locked periods are immutable
- Reopening requires reason and permission
- Export history with checksums

### Roles & Permissions
- HR_ADMIN: full employee and payroll management
- HR_OFFICER: employee registration, editing, data entry
- FINANCE_PAYROLL: review, calculations, export, locking
- AUDITOR: read-only
- Salary/payment fields permission-protected

## Models Used
- User, Role, Permission, UserRole, RolePermission
- Employee, EmployeeSalary (salary history)
- EmployeePayrollProfile (payment method, bank, M-PESA, tax/pension IDs)
- EmployeeStatusHistory
- AuditLog
- Department, Location
- PayrollPeriod (DRAFT, READY, LOCKED, CANCELLED)
- PayrollRow (monthly payroll data per employee per period)
- PayrollExport (generated Excel records with checksums)
- ImportSession, ImportRow (employee import)

## Features Hidden from Navigation
- Advanced payroll calculation engine (PayrollPreparationBatch, PayrollCalculationLine)
- Complex statutory configuration (PAYE brackets, pension rules)
- Shop Manager Incentives
- Payroll Output Packages
- Payslips
- Payment Batches
- Statutory Reports
- Payroll Journals
- Payment Export Templates
- Data Quality dashboard
- Change Requests
- Phase Control
- Document Rules
- Salary Structure (components, rules, approvals)
- Onboarding checklist
- Employee evaluations
- Disciplinary records
- Termination cases
- Transfer/Promotion requests
- Commission plans
- Leave records and policies
- KPI metrics and assignments
- Attendance records
- Employee profile change requests
- Notifications
