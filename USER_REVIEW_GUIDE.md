# Leapfrog HRMS — Phase 1 User Review Guide

## Review Scope

This review covers Phase 1 — the HRIS foundation. The following workflows are ready for validation:

### 1. Login
- Open `http://localhost:3000`
- Sign in as `admin@leapfrog.com` / `Admin123!`
- Verify you reach the dashboard
- Sign out, try invalid credentials — verify error message does not reveal whether the email exists
- Sign in as `employee@leapfrog.com` / `Emp123!` — verify dashboard shows "You do not have access to any modules"

### 2. Dashboard Navigation
- Sign in as `hr.admin@leapfrog.com` — verify all HR, Reports & Audit sections appear
- Verify Finance section does NOT appear (HR_ADMIN does not have salary.view)
- Sign in as `auditor@leapfrog.com` — verify only Reports & Audit section appears
- Sign in as `finance.director@leapfrog.com` — verify Finance section appears (Salary Records)

### 3. Employees
- Navigate to Employees
- Verify list shows 8 sample employees with correct IDs (LSTA_0001–LSTA_0008)
- Use search to filter
- Verify pagination works

### 4. Organization
- Navigate to Organization Chart
- Verify department tree shows Head Office → HR, Finance, Sales, etc.
- Verify locations show Ethiopia data (Addis Ababa, Bole, Megenagna, etc.)
- No Kathmandu or unrelated locations should appear

### 5. Onboarding
- Navigate to Onboarding
- Verify 8 checklists exist with 11 items each
- Toggle item completion — verify it updates and shows strikethrough

### 6. Assignments
- Navigate to Assignments
- Verify list is empty or shows seeded data
- (Assignments are created via API — no create UI in Phase 1)

### 7. Status History
- Navigate to Status History
- Verify list is empty (no status changes have been made yet)
- Status changes are recorded via the status API

### 8. Salary Records
- Sign in as `finance.director@leapfrog.com`
- Navigate to Salary Records (via dashboard or `/salary`)
- Verify salary data is visible
- Sign in as `employee@leapfrog.com` — verify salary link is hidden

### 9. Audit Logs
- Sign in as `auditor@leapfrog.com`
- Navigate to Audit Logs
- Verify seed audit log entry appears
- Verify login page shows entries

### 10. Reports
- Sign in as `hr.admin@leapfrog.com`
- Navigate to Reports
- Verify counts (total employees, active, onboarding pending, etc.)
- Verify breakdowns by department, role, employment type

### 11. Users
- Sign in as `admin@leapfrog.com`
- Navigate to Users & Roles (if link appears)
- Verify 12 seeded users are listed

## Not Enabled in Phase 1

- Document upload/management
- Leave requests and balances
- Employee evaluations
- Achievements
- Disciplinary records
- Termination/exit workflows
- Transfers/promotions
- Approval routing
- Payroll preparation and calculation
- Commission plans
- PAYE/pension rules
- Employee/manager self-service
- Email notifications
- External integrations
