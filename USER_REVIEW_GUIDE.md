# Leapfrog HRMS — Phase 2B User Review Guide

## Review Scope

This review covers Phase 2B: Employee Import from Excel/CSV, Payroll Readiness Validation, and Employee Payroll Profiles. Baseline v1.0 and Phase 2A are also verified for regression.

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
- Verify tabs: Profile, Assignments, Status History, Documents, Onboarding
- Profile tab shows organization info, manager, category badge
- Assignments tab shows current/past assignments with active indicator
- Status History tab shows status changes

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

---

## Phase 2B: Employee Import & Payroll Readiness

### 9. Import Employees from CSV
- Login as HR Admin (`hr.admin@leapfrog.com` / `Test123!`)
- Navigate to Employees → "Import" button (or `/employees/import`)
- Upload a CSV file with employee data (sample format below)
- **Step 1:** Upload file — verify file name, size, and row count shown
- **Step 2:** Map columns — verify auto-detected mappings, confirm or adjust
- **Step 3:** Preview — verify row-by-row validation with VALID/WARNING/ERROR status
  - Rows with errors (missing category, missing role, missing shop for Shop Manager) show red ERROR
  - Rows with warnings (missing optional fields) show yellow WARNING
  - Duplicate matches show as DUPLICATE
- **Step 4:** Confirm — review summary, click "Confirm Import" to create employees
- Verify imported employees appear in the employee list

### 10. Import Sample CSV Format
```csv
fullName,gender,employeeCategory,role,employmentStatus,basicSalary,department,shop,region,area,phone,employmentType,level,hireDate
Abebe Kebede,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,45000,Human Resources,,,Addis Ababa,0911100001,FULL_TIME,SENIOR,2024-01-15
Fikru Tesfaye,MALE,SHOP_FIELD,DSP,ACTIVE,12000,,Megenagna Shop,Addis Ababa,Megenagna,0911100002,FULL_TIME,JUNIOR,2024-03-01
```

### 11. Verify Import Validation Rules
Upload a CSV with intentional errors:
- Row missing employee category → ERROR "Employee category is required"
- Row missing role → ERROR "Role is required"
- Shop Manager without shop assignment → ERROR "Shop Manager requires a shop assignment"
- Head Office without department → ERROR "Head Office employees require a department"
- Missing basic salary → WARNING "Basic salary is missing"
- Missing phone number → WARNING "Phone number is missing"
- Missing hire date → WARNING "Hire date is missing"

### 12. Verify Import Permission Restriction
- Sign in as `employee@leapfrog.com` (no employee.import permission)
- Navigate to `/employees/import`
- Verify you see "Access Denied" and cannot proceed

### 13. Import History
- After importing, navigate to `/employees/import/history`
- Verify the import session appears with file name, mode (CREATE_ONLY), row counts, status (COMPLETED)
- Click a session to see row-level detail (individual row status, errors, matched employees)

### 14. Payroll Readiness Dashboard
- Login as HR Admin
- Navigate to Payroll Readiness (`/employees/payroll-readiness`)
- Verify summary cards show: total employees, ready count, warning count, not ready count
- Verify the table shows each employee with readiness %, status badge (READY/WARNING/NOT_READY/INACTIVE), and blocker details
- Test filters: filter by status (READY, WARNING, NOT_READY, INACTIVE)

### 15. Payroll Readiness Checks
- CEO (`admin@leapfrog.com`) should be READY (has salary, payment info, bank, tax, pension, assignment, manager)
- Check an employee with no salary → should show NOT_READY
- Check DSP (`dsp@leapfrog.com`) → may show WARNING (uses mobile money, may lack tax/pension)
- Check DSA (`dsa@leapfrog.com`) → should show NOT_READY (no payroll profile seeded)

### 16. Export Payroll Readiness
- On the Payroll Readiness page, click "Export CSV"
- Verify a CSV file downloads with all employees and their readiness status

### 17. Employee Payroll Profile (Seed Data)
- Navigate to HR Manager profile (Almaz Tesfaye) — has full payroll profile with bank details
- Navigate to Shop Manager (Tesfaye Hailu) — uses mobile money (M-PESA)
- Navigate to DSP (Kidus Yohannes) — uses mobile money, no tax/pension IDs

### 18. Regression Check
- Verify Head Office registration still works (Step 2 from baseline)
- Verify Shop/Field registration still works (Step 3 from baseline)
- Verify Shop Accountant dual reporting still works (Step 6 from baseline)
- Verify Salary is still REDACTED for unauthorized users
- Verify manager scope still restricts visibility
- Verify document upload/download/deactivate still works (Phase 2A steps 1-4)
- Verify required document rules still exist (Phase 2A step 5)
- Verify onboarding completion still works (Phase 2A steps 6-8)

## Known Limitations

- Import preview creates no records — only ImportSession + ImportRows for validation review
- Import does not auto-assign employees to shops; assignment must be done separately after import
- Payroll readiness is informational only — no enforcement or auto-correction
- No email notifications for import results
- Import does not support nested JSON (e.g., assignment within import)
- No auto-reminders for missing payroll information

---

## Test Commands

```powershell
npm test              # Run all 137 tests (42 baseline + 41 Phase 2A + 54 Phase 2B)
npm run test:phase1   # Run baseline tests only (42)
npm run test:phase2a  # Run Phase 2A tests only (41)
npm run test:phase2b  # Run Phase 2B tests only (54)
npm run typecheck
npm run lint
npm run build
```
