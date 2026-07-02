# Leapfrog HRMS — Phase 4A User Review Guide

## Review Scope

This review covers Phase 4A: Payroll Period Setup and Monthly Input Collection. Phase 3 (Salary Structure, Pay Components, Pay Rules), Phase 3.5, Phase 2B, Phase 2A, and Baseline v1.0 are also verified for regression.

## Baseline Tests (Quick Check)

### 1. Login as HR Admin
- Open `http://localhost:3000`
- Sign in as `hr.admin@leapfrog.com` / `Test123!`
- Verify you reach the dashboard with HR, Finance, Reports & Audit sections visible

### 2. Register a Head Office Employee
- Click "Employees" → "+ Register Employee"
- Select "Head Office Department"
- Fill in: First Name, Last Name, select Department (e.g., HR), Position/Role (e.g., HR_OFFICER), Direct Manager
- Submit — verify you reach the new employee's profile page with "Head Office" badge

### 3. Register a Shop Manager
- Go to Employees → "+ Register Employee"
- Select "Shop / Field Structure"
- Select Position/Role = "Shop Manager"
- Select Region/Area and a Shop
- Submit — verify profile shows "Shop / Field" badge and shop assignment

### 4. Register Shop Accountant with Dual Reporting
- Select "Shop / Field Structure", Position = "Shop Accountant"
- Verify "Accounting Reporting Manager" field appears and defaults to HO Treasury Manager
- Submit — verify both shop assignment and accounting reporting manager shown

### 5. Confirm Salary Visibility Restriction
- `hr.admin@leapfrog.com` — salary visible
- `employee@leapfrog.com` — salary shows "Restricted"
- `finance.director@leapfrog.com` — salary visible

### 6. Confirm Manager Scope
- `asm@leapfrog.com` — employee list accessible
- `shop.manager@leapfrog.com` — scoped to own shop employees

### 7. Confirm Audit Logs
- `auditor@leapfrog.com` — audit logs visible

---

## Phase 2A: Document & Onboarding Workflows

### 1. Upload Employee Documents
- Login as HR Admin
- Open an employee profile → Documents tab
- Upload ID document with "Visible to HR" visibility
- Verify document appears in the list

### 2. Required Document Status
- Verify completion progress bar updates
- Uploaded documents show "Uploaded", missing show "Missing"

### 3. Document Visibility Permissions
- Login as Shop Manager — verify MANAGER_VISIBLE docs visible, SENSITIVE_HR_ONLY hidden

### 4. Salary-Restricted Documents
- Finance Director CAN view salary documents
- HR Officer CANNOT (no salary.view)

### 5. Manage Required Document Rules
- Login as HR Admin → `/document-rules`
- Verify 9 seeded rules visible
- Create, edit, deactivate a rule

### 6-8. Onboarding Completion & Override
- Complete onboarding when all docs submitted
- Verify blockers when docs missing
- Verify HR Admin override with reason works

---

## Phase 2B: Employee Import & Payroll Readiness

### 9. Import Employees from CSV
- Login as HR Admin → Employees → "Import"
- Upload a CSV, verify auto-detected column mappings
- Preview with VALID/WARNING/ERROR rows
- Confirm import — verify employees appear in list

### 10. Import Validation Rules
- Missing category → ERROR
- Missing role → ERROR
- Shop Manager without shop → ERROR
- Head Office without department → ERROR
- Missing salary → WARNING

### 11. Import History
- `/employees/import/history` — verify session with row counts and drill-down

### 12. Payroll Readiness Dashboard
- `/employees/payroll-readiness` — verify summary cards, table with status badges, blockers

### 13. Payroll Readiness Checks
- CEO → READY (has salary, payment info, bank, tax, pension)
- DSA → NOT_READY (no payroll profile)

### 14. Export Payroll Readiness
- Click "Export CSV" — verify CSV downloads

---

## Phase 3: Salary Structure & Pay Component Rules

### 1. View Salary Structure Dashboard
- Login as Finance Director (`finance.director@leapfrog.com` / `Test123!`)
- Navigate to `/salary-structure` (or click "Salary Structure" under Finance on the Dashboard)
- Verify the dashboard shows:
  - **Components** count (8 from seed)
  - **Total Rules** count (4 from seed)
  - **Active** count
  - **Draft** count
- Verify quick links: "Manage Pay Components", "Manage Pay Rules", "Rule Preview Tool"

### 2. Browse Pay Components
- Click "Manage Pay Components" (or `/salary-structure/components`)
- Verify the table shows 8 seeded components:
  - BASIC_SALARY, TRANSPORT_ALLOWANCE, KPI_ALLOWANCE, OVERTIME, SALES_COMMISSION, BONUS, ADJUSTMENT, DEDUCTION
- Verify each row shows: Code, Name, Type, Tax Treatment, Status badge
- Verify Active badge is green, Inactive is red

### 3. Create a New Pay Component
- Click "+ New Component"
- Fill in: Code = `TEST_REVIEW`, Name = `Review Test Allowance`
- Select Type = `ALLOWANCE`, Tax = `NON_TAXABLE`, check "Is Earning"
- Submit — verify new component appears in table with Active badge
- Click "+ New Component" again, enter same code `TEST_REVIEW`
- Verify error: "Component code already exists"

### 4. Deactivate a Pay Component
- Find your `TEST_REVIEW` component, click "Deactivate"
- Verify confirmation dialog appears
- Confirm — verify badge changes to "Inactive"

### 5. Browse Pay Rules
- Click "Manage Pay Rules" (or `/salary-structure/rules`)
- Verify the table shows 4 seeded rules:
  - DSA Transport Allowance (THRESHOLD, ACTIVE)
  - DSA KPI Allowance (TIERED, ACTIVE)
  - Manual Adjustment (MANUAL_INPUT, ACTIVE)
  - DSA Sales Commission (TIERED, DRAFT)
- Verify each row shows: Name, Component Code, Method, Role, Status badge, Effective date, Action buttons

### 6. Create a New Pay Rule
- Click "+ New Rule"
- Fill in:
  - Component = BASIC_SALARY
  - Name = "Review Fixed Test Rule"
  - Rule Type = FIXED_AMOUNT
  - Base Amount = 5000
  - Status = DRAFT
  - Effective From = today's date
  - Priority = 5
- Submit — verify redirected to rules list with new rule visible

### 7. Create a Percentage Rule (Preview Testing)
- Click "+ New Rule"
- Component = KPI_ALLOWANCE
- Name = "Review % Test Rule"
- Rule Type = PERCENTAGE
- Percentage Rate = 15
- Max Amount = 3000
- Status = DRAFT
- Effective From = today's date
- Submit

### 8. Create a Tiered Rule
- Click "+ New Rule"
- Component = SALES_COMMISSION
- Name = "Review Tiered Test Rule"
- Rule Type = TIERED
- Max Amount = 10000
- Tier Config JSON:
  ```json
  [{"min":90,"percent":10,"amount":10000},{"min":70,"percent":5,"amount":5000},{"min":0,"percent":0,"amount":0}]
  ```
- Submit

### 9. View & Edit a Rule
- Click on any rule name to open its detail page (`/salary-structure/rules/:id`)
- Verify all fields shown: Status, Type, Method, Priority, Role, Amounts, Effective dates
- Click "Edit" — modify the name or description
- Click "Save" — verify changes reflected

### 10. Activate a Rule
- Open the DSA Sales Commission rule (status = DRAFT)
- Click "Activate"
- Verify status changes to "Active" (green badge)
- Verify success (no validation errors)

### 11. Test Duplicate Activation Prevention
- Create another rule with the same component, role, and effective date as the DSA Transport Allowance
- Try to activate it
- Verify error: "An active rule already exists for the same component, scope, and effective date"

### 12. Deactivate a Rule
- Open any Active rule, click "Deactivate"
- Verify status changes to "Inactive"

### 13. Rule Preview Tool
- Navigate to `/salary-structure/preview`
- Filter by component (e.g., KPI_ALLOWANCE)
- Select the "Review % Test Rule" you created
- Enter Input Value = 20000
- Click "Calculate Preview"
- Verify result shows:
  - Calculated Amount: 3000 (20000 * 15% = 3000, capped at 3000)
  - Explanation
  - Warning about cap

### 14. Preview Different Calculation Methods
- Select DSA Transport Allowance (THRESHOLD)
- Input = 45 (above threshold of 40) → Calculated Amount = 1500 (flat amount)
- Input = 40 (at threshold of 40) → Calculated Amount = 1500 (flat amount)
- Input = 39.99 (below threshold) → Calculated Amount = 0
- Input = 35 (below threshold) → Calculated Amount = 0
- Select DSA KPI Allowance (TIERED)
- Input = 65 → Calculated Amount = 2000 (>=60% tier — flat amount)
- Input = 60 → Calculated Amount = 2000 (>=60% tier — flat amount)
- Input = 50 → Calculated Amount = 1000 (>=40% tier — flat amount)
- Input = 40 → Calculated Amount = 1000 (>=40% tier — flat amount)
- Input = 39.99 → Calculated Amount = 0 (bottom tier)
- Input = 35 → Calculated Amount = 0 (bottom tier)

### 15. Verify Permission Restrictions
- Login as `employee@leapfrog.com`
- Navigate to `/salary-structure` — verify you see "Access Denied" or are redirected
- Directly visit `/api/salary-structure/components` — verify 403 response
- Login as `hr.admin@leapfrog.com`
- Navigate to `/salary-structure` — verify visible
- Verify HR Admin CAN view components and rules
- Verify HR Admin CAN create/edit components (now has manageComponents)
- Verify HR Admin CAN create/edit rules (now has manageRules)
- Verify HR Admin CAN activate/deactivate rules (now has activateRule/deactivateRule)
- Verify HR Admin CAN preview rules (now has preview)
- Login as `hr.officer@leapfrog.com`
- Verify HR Officer can view BUT CANNOT create components (no manageComponents)

### 16. Audit Logging Verification
- Login as `auditor@leapfrog.com` / `Test123!`
- Navigate to Audit Logs
- Verify Phase 3 audit entries appear:
  - PAY_COMPONENT_CREATE (for TEST_REVIEW component)
  - PAY_COMPONENT_DEACTIVATE (for TEST_REVIEW deactivation)
  - PAY_RULE_CREATE (for each rule created)
  - PAY_RULE_ACTIVATE (for DSA Sales Commission activation)
  - PAY_RULE_DEACTIVATE (for deactivated rule)
  - PAY_RULE_PREVIEW (for each preview calculation)

### 17. Safe Activation (Cannot Set ACTIVE via Create/PATCH)
- Login as Finance Director
- Create a new rule via POST — try setting `status: "ACTIVE"` in the request body
- Verify the API returns error: "Cannot create rule with ACTIVE status; use the activate endpoint"
- Use PATCH on a DRAFT rule — try setting `status: "ACTIVE"` in the request body
- Verify the API returns error: "Cannot set ACTIVE via PATCH; use the activate endpoint"
- Verify only the dedicated activate endpoint (`POST /rules/:id/activate`) can transition a rule to ACTIVE
- Verify the new-rule form only offers "Draft" status (no "Active" option)

### 18. Component Inline Edit
- Navigate to `/salary-structure/components`
- Click "Edit" on any active component (e.g., TRANSPORT_ALLOWANCE)
- Verify inline editing opens for: Name, Description, Type, Tax Treatment, Flags
- Verify Code field is NOT editable (immutable after creation)
- Change the name to "Transport Allowance (Updated)", click "Save"
- Verify the table row updates without page reload
- Click "Cancel" on another component to verify cancel works

### 19. Regression Check
- Verify Head Office registration still works
- Verify Shop/Field registration still works
- Verify Shop Accountant dual reporting preserved
- Verify Salary REDACTED for unauthorized users
- Verify document upload/download/deactivate works
- Verify required document rules still exist
- Verify import still works (upload CSV, map, preview, confirm)
- Verify payroll readiness dashboard still works
- Verify employee list and profile pages still work

---

## Phase 4A: Payroll Period Setup & Monthly Input Collection

### 1. Login and Navigate
- Login as HR Admin (`hr.admin@leapfrog.com` / `Test123!`)
- Navigate to the Payroll Period page
- Verify you see the Payroll Period management UI

### 2. Create a Payroll Period
- Click "+ New Payroll Period"
- Enter Period Name (e.g., "July 2026"), select date range
- Submit — verify the period appears in the list with DRAFT status
- Verify only one OPEN_FOR_INPUT period is allowed (try opening a second one)

### 3. Open for Input
- Click "Open for Input" on the draft period
- Verify status changes to OPEN_FOR_INPUT
- Verify dates cannot be edited after opening

### 4. Employee Selection
- Open the payroll period → "Select Employees"
- Verify eligible employees are shown (ACTIVE, ON_PROBATION, ONBOARDING)
- Verify payroll readiness status is displayed for each employee
- Add employees to the period
- Remove an employee while period is still draft

### 5. Input Type Management
- Navigate to Input Types
- Verify 8 default input types are seeded
- Create a new input type
- Update an existing input type
- Deactivate an input type — verify it cannot receive new inputs

### 6. Monthly Input Collection
- Navigate to Monthly Input within a payroll period
- Login as a user with create access (e.g., FINANCE_PAYROLL)
- Create an input record, save as draft
- Edit and submit the draft input
- Verify submitted input can be accepted
- Verify submitted input can be rejected with a reason stored
- Login as EMPLOYEE — verify they cannot create inputs

### 7. Department Submission Tracking
- Navigate to the submission tracking view
- Verify departments are listed with their submission status
- Verify you can see which departments have submitted and which are pending

### 8. CSV Import
- Navigate to CSV import for monthly inputs
- Upload a CSV with employee IDs, input type codes, and values
- Preview — verify validation catches missing employeeId, missing inputTypeCode, duplicates
- Confirm import — verify valid rows are created, invalid rows are skipped
- Test different import modes: CREATE_ONLY, UPDATE_DRAFT_ONLY, SKIP_EXISTING

### 9. Permissions Verification
- Login as SUPER_ADMIN — verify full access
- Login as HR_ADMIN — verify full Phase 4A access
- Login as HR_OFFICER — verify limited view/create access
- Login as FINANCE_DIRECTOR — verify view/open/close/review/export
- Login as FINANCE_PAYROLL — verify create/update/submit/review/import/export
- Login as SALES_HEAD — verify view/create/submit for shop/field scope
- Login as ASM — verify view/create/submit for assigned area scope
- Login as SHOP_MANAGER — verify view/create/submit for own shop scope
- Login as EMPLOYEE — verify no Phase 4A access
- Login as AUDITOR — verify view-only access

### 10. Close and Cancel
- Close input collection on an OPEN_FOR_INPUT period
- Cancel a DRAFT period
- Verify closed/canceled periods are reflected in the UI

## Known Limitations (Phase 3)

- Phase 3 is salary-structure setup only — no monthly payroll, payslips, tax, pension, or payment export
- Rule preview is calculation-only — does not create actual payroll records
- No monthly payroll run, payslips, tax, pension, or payment export in Phase 3
- Commission rules are structural — no final commission calculation
- Component tax treatment is UNKNOWN by default — tax behavior finalized in a later phase
- No approval workflow for rule changes — activation is immediate
- DSA Transport Allowance pays flat 1,500 birr when sales >= 40% (not a percentage calculation)
- DSA KPI Allowance pays flat amounts per tier (2000, 1000, 0 — no percentage component)

## Test Commands

```powershell
npm test              # Run all tests (42 Phase 1 + 41 Phase 2A + 27 Phase 2B + 38 Phase 3 + 78 Phase 3.5 + 35 Phase 4A = 261)
npm run test:phase1   # Run baseline tests only (42)
npm run test:phase2a  # Run Phase 2A tests only (41)
npm run test:phase2b  # Run Phase 2B tests only (27)
npm run test:phase3   # Run Phase 3 tests only (38)
npm run test:phase3_5 # Run Phase 3.5 tests only (78)
npm run test:phase4a  # Run Phase 4A tests only (35)
npm run test:phase4c1 # Run Phase 4C.1 tests only (85)
npm run typecheck
npm run lint
npm run build
```

---

## Phase 4C.1 — Shop Master and Shop Status Setup

### What was built

Phase 4C.1 builds the shop management foundation needed before Shop Manager incentive calculation.

### Prerequisites

Log in as one of:
- `admin@leapfrog.com` / `Test123!` (SUPER_ADMIN — full access)
- `hr.admin@leapfrog.com` / `Test123!` (HR_ADMIN — full access)
- `sales.head@leapfrog.com` / `Test123!` (SALES_HEAD — create/edit/view)
- `asm@leapfrog.com` / `Test123!` (ASM — view only, scoped to area)
- `shop.manager@leapfrog.com` / `Test123!` (SHOP_MANAGER — view own shop only)
- `finance.director@leapfrog.com` / `Test123!` (FINANCE_DIRECTOR — view)
- `auditor@leapfrog.com` / `Test123!` (AUDITOR — view)

### 1. Navigate to Shops

- Click **Organization Setup > Shops** on the dashboard
- You should see a list of seeded shops with columns: Code, Name, Region, Area, Cluster, Manager, Corridor, Criteria, Incentive, Active, Actions
- Use filters at the top: Region, Area, Criteria, Corridor Type, Active/Inactive, Incentive Eligible

### 2. Create a Shop

- Click **Create Shop** (or navigate to `/shops/new`)
- Fill in:
  - Shop Name (required)
  - Shop Code (required, must be unique)
  - Region (select from dropdown)
  - Area (auto-populates after region selection)
  - Cluster (auto-populates after area selection)
  - Shop Manager (select from active SHOP_MANAGER employees)
  - Corridor Type (CORRIDOR / NON_CORRIDOR / UNKNOWN)
  - Incentive Eligible (checkbox)
- Click "Create Shop"
- Verify you're redirected to the shops list and the new shop appears

### 3. View Shop Detail

- Click the **View** (eye) icon on any shop
- Verify the detail page shows:
  - Shop Profile (code, status, hierarchy, corridor, incentive, criteria)
  - Shop Manager (name, employee ID, role, status)
  - Criteria History table
  - Assigned Employees table

### 4. Edit a Shop

- Click the **Edit** icon on any shop
- Change the shop name, parent location, shop manager, corridor type, or incentive eligibility
- Click "Save Changes"
- Verify the changes appear on the detail page

### 5. Update Shop Criteria

- Click the **Update Criteria** icon on any shop
- Select a criteria value: Gold / Silver / Bronze / At Risk / Unassigned
- Set an effective date
- Enter a reason (required)
- Optionally select an approved by user
- Click "Update Criteria"
- Verify the criteria history on the detail page shows the new entry

### 6. Deactivate / Reactivate a Shop

- Click the **Deactivate** (X) icon on an active shop
- Verify the shop shows as "Inactive" in the list
- Click the **Reactivate** (checkmark) icon on an inactive shop
- Verify the shop shows as "Active" again

### 7. Scope Testing

- Log in as `asm@leapfrog.com` and verify only shops in the assigned area are visible
- Log in as `shop.manager@leapfrog.com` and verify only the own shop is visible
- Log in as `employee@leapfrog.com` and verify no shop access

### What is NOT implemented

- Shop Manager incentive calculation
- Payroll / Tax / Pension calculation
- Payslip generation
- Payment export (bank or M-PESA)

These will be handled in Phase 4C.2 and Phase 5.
```
