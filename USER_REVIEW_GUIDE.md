# Leapfrog HRMS — Starter User Review Guide

## Review Scope

This review covers the employee registration starter workflow — Head Office and Shop/Field employees only. The following workflows are ready for validation:

### 1. Login as HR Admin
- Open `http://localhost:3000`
- Sign in as `hr.admin@leapfrog.com` / `Test123!`
- Verify you reach the dashboard with HR, Reports & Audit sections visible

### 2. Register a Head Office Employee
- Click "Employees" → "+ Register Employee"
- Select "Head Office Department"
- Fill in: First Name, Last Name, select Department (e.g., HR), Position/Role (e.g., HR_OFFICER), Direct Manager
- Verify the form does NOT require shop or cluster fields
- Submit — verify you reach the new employee's profile page
- Verify the employee shows "Head Office" category badge

### 3. Register a Shop Manager
- Go to Employees → "+ Register Employee"
- Select "Shop / Field Structure"
- Select Position/Role = "Shop Manager"
- Select Region/Area and a Shop
- Verify Direct Manager defaults to ASM if available
- Submit — verify profile shows "Shop / Field" badge and shop assignment

### 4. Register DSP under a Shop Manager
- Go to Employees → "+ Register Employee"
- Select "Shop / Field Structure"
- Select Position/Role = "DSP - Indoor Sales"
- Select Region/Area and a Shop
- Verify Direct Manager defaults to Shop Manager of selected shop if available
- Submit — verify DSP has correct manager

### 5. Register DSA under a Shop Manager
- Same as DSP but select Position/Role = "DSA - Outdoor Sales"
- Verify DSA has correct manager assignment

### 6. Register Shop Accountant with HO Treasury Accountant reporting line
- Go to Employees → "+ Register Employee"
- Select "Shop / Field Structure"
- Select Position/Role = "Shop Accountant"
- Select Region/Area and a Shop
- Verify "Accounting Reporting Manager" field appears
- Verify it auto-defaults to HO Treasury Manager (Henok Desta) if available
- Submit — verify profile shows both shop assignment and accounting reporting manager

### 7. Confirm Salary Visibility Restriction
- Sign in as `hr.admin@leapfrog.com` — navigate to any employee profile
- Verify salary is visible
- Sign out, sign in as `employee@leapfrog.com` (no salary.view permission)
- Navigate to same employee profile — verify salary shows "Restricted" or is hidden
- Sign in as `finance.director@leapfrog.com` — verify salary is visible

### 8. Confirm Manager Scope
- Sign in as `asm@leapfrog.com` (ASM role, has employee.view)
- Navigate to Employees — verify employee list is accessible
- (Scope filtering is data-level; ASM can see all employees via list but scope enforcement is planned)

### 9. Confirm Audit Logs
- Sign in as `auditor@leapfrog.com` / `Test123!`
- Navigate to Audit Logs
- Verify seed audit log entry appears
- After creating employees in steps 2-6, verify corresponding audit entries exist (EMPLOYEE_CREATE, MANAGER_CHANGE, ACCOUNTING_MANAGER_CHANGE, etc.)

## Extra: Employee Category Filter
- On the Employees page, use the "Category" dropdown to filter by "Head Office" or "Shop / Field"
- Verify only matching employees appear

## Extra: Employee Profile Tabs
- Navigate to any employee profile
- Verify tabs: Profile, Assignments, Status History, Onboarding
- Profile tab shows organization info, manager, category badge
- Assignments tab shows current/past assignments with active indicator
- Status History tab shows status changes

## Not Enabled in This Starter Build

- Document upload/management
- Leave requests and balances
- Employee evaluations
- Payroll preparation and calculation
- Commission plans
- Disciplinary records
- Termination/exit workflows
- Transfers/promotions
- Approval routing
- Employee/manager self-service
- Email notifications
- External integrations

Do not claim these modules are ready.
