# User Guide — Leapfrog HR MVP

## Roles

| Role | Capabilities |
|------|-------------|
| HR_ADMIN | Full employee and payroll management |
| HR_OFFICER | Employee registration, editing, data entry |
| FINANCE_PAYROLL | Review, calculations, export, locking |
| AUDITOR | Read-only access to all modules |

## Employee Management

### Add Employee
1. Go to Dashboard > Employees
2. Click "Add Employee"
3. Fill in Personal Information (name, email, phone, gender)
4. Fill in Employment Details (department, role, status)
5. Set Compensation (basic salary, effective date)
6. Fill in Payroll Profile (payment method, bank, M-PESA, tax ID, pension ID)
7. Click "Save"

### Edit Employee
1. Click an employee name
2. Click "Edit"
3. Update fields as needed
4. Click "Save Changes"

### Import Employees
1. Go to Employees > Import
2. Upload Excel/CSV file
3. Review preview
4. Confirm import

## Payroll Management

### Create Payroll Period
1. Go to Dashboard > Payroll
2. Click "New Period"
3. Select month and year
4. Set pay date (optional, defaults to month end)
5. Click "Create Period"

### Prepare Payroll
1. Open the period
2. Click "Snapshot Active Employees" to copy employees into the table
3. Edit monthly values in the table (allowance, overtime, etc.)
4. Click "Calculate Gross/Net" to run calculations
5. Click "Validate Rows" to check for errors
6. Fix any errors shown in the table
7. Click "Mark Ready" when ready

### Export Payroll
1. With a READY or LOCKED period, click "Export Excel"
2. The workbook will be generated and downloaded
3. Go to "View Export History" for past exports

### Lock Period
1. Ensure period is READY
2. Click "Lock Period"
3. Locked periods are immutable

### Reopen Period
1. Only possible for LOCKED periods
2. Click "Reopen"
3. Provide a reason (required)
4. Period returns to DRAFT status
