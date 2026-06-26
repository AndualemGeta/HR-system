# Leapfrog HRMS — Phase 2A User Review Guide

## Review Scope

This review covers Phase 2A: Employee Documents, Required Document Rules, and Onboarding Completion. Baseline v1.0 (employee registration) is also verified for regression.

## Baseline Tests (Quick Check)

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

---

## Phase 2A: Document & Onboarding Workflows

### 1. Upload Employee Documents
- Login as HR Admin (`hr.admin@leapfrog.com` / `Test123!`)
- Open an employee profile (e.g., a Shop/Field employee)
- Click the "Documents" tab
- Verify the "Required Documents" section shows which documents are missing
- Click "Upload Document"
- Select document type: ID, set visibility to "Visible to HR"
- Upload a small PDF/JPG file
- Submit — verify you return to the profile and see the document listed
- Repeat to upload a CONTRACT document

### 2. View Required Document Status
- Stay on the Documents tab
- Verify the completion progress bar updates
- Check that uploaded documents show as "Uploaded" next to their required type
- Verify missing documents show as "Missing" in red

### 3. Test Document Visibility Permissions
- Login as a Shop Manager (`shop.manager@leapfrog.com` / `Test123!`)
- Open the same employee's profile
- Go to the Documents tab
- Verify you can see PUBLIC_TO_HR and MANAGER_VISIBLE documents
- Verify you CANNOT see SENSITIVE_HR_ONLY documents

### 4. Test Salary-Restricted Document Access
- Login as HR Admin and upload a SALARY_DOCUMENT with SALARY_RESTRICTED visibility
- Login as Finance Director (`finance.director@leapfrog.com` / `Test123!`)
- Verify Finance Director CAN view the salary-restricted document (has document.view + salary.view)
- Login as HR Officer (`hr.officer@leapfrog.com` / `Test123!`)
- Verify HR Officer CANNOT view the salary-restricted document (no salary.view)

### 5. Manage Required Document Rules
- Login as HR Admin
- Navigate to `/document-rules`
- Verify you see the 9 seeded rules (ID, Contract, Emergency Contact, CV, Confidentiality, Responsibility Document, Assignment Letter, Bank/Payment Information)
- Click "Add Rule" — create a new rule: Name = "Commission Agreement for DSA", Document Type = COMMISSION_AGREEMENT, Role = DSA
- Submit and verify it appears in the table
- Click "Edit" on any rule and change its name
- Click "Deactivate" on a rule and verify it shows as Inactive

### 6. Complete Onboarding
- Find an employee with ONBOARDING status (or create a new employee)
- Upload all required documents (ID, Contract, Emergency Contact)
- Go to the Onboarding tab
- Verify document progress shows 100%
- Click "Complete Onboarding"
- Verify onboarding completes successfully
- Check the audit logs (`/audit-logs` or via Auditor login) for ONBOARDING_COMPLETE

### 7. Test Onboarding Blockers
- Create a new employee and do NOT upload any documents
- Go to the Onboarding tab and click "Complete Onboarding"
- Verify you see blockers listing missing documents
- The onboarding should not complete

### 8. Test HR Admin Override
- With still-incomplete employee from step 7, click "Complete Onboarding" again
- Enter an override reason when prompted
- Verify onboarding completes despite missing documents
- Check audit logs for ONBOARDING_OVERRIDE with the reason

### 9. Verify Audit Logs
- Login as Auditor (`auditor@leapfrog.com` / `Test123!`)
- Navigate to `/audit-logs`
- Verify you can see DOCUMENT_UPLOAD, DOCUMENT_DEACTIVATE, ONBOARDING_COMPLETE, DOCUMENT_RULE_CREATE entries

### 10. Regression Check
- Verify Head Office registration still works (Step 2 from baseline)
- Verify Shop/Field registration still works (Step 3 from baseline)
- Verify Shop Accountant dual reporting still works (Step 6 from baseline)
- Verify Salary is still REDACTED for unauthorized users
- Verify manager scope still restricts visibility

## Known Limitations (Phase 2A)

- File upload uses local filesystem (`uploads/employee-documents/`)
- No email notifications for document uploads or missing documents
- Employee self-service for document viewing is limited
- Onboarding completion does not auto-change employee status to ACTIVE
- No document preview (download only)
- No automatic reminders for missing documents
