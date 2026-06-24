# Leapfrog HR Management System

Secure, role-based HR Management System for Leapfrog Software Technology Africa PLC.

Phase 1 provides the core HR foundation. Phase 2 adds HR operations: HR file import and validation, employee documents, leave records, achievements, evaluations, configurable criteria, manager evaluation access, expanded reports, and audit logging. Phase 3 adds the advanced HR lifecycle layer: disciplinary records, termination and exit, transfers, promotions, approval routing, notifications, advanced reports, exports, and safe employee self-service. Phase 4 adds payroll preparation, KPI foundations, analytics, compliance, notification preferences, profile change requests, approval governance controls, data quality tracking, HR reminders, system settings, and export history. Phase 4.5 connects evaluation recommendations, salary review, commission calculation, payroll rules, attendance proration, overtime, allowances, deductions, PAYE, pension, payroll warnings, and payroll-ready compensation exports.

## Tech Stack

- Next.js App Router with TypeScript
- Prisma ORM with PostgreSQL
- Email/password login with signed HTTP-only session cookies
- Role-based access control with manager/reporting-scope checks
- Local development document storage under `uploads/`
- CSV/XLS/XLSX parsing with `papaparse` and `exceljs`
- CSV/XLSX exports with scoped data redaction
- Payroll preparation exports limited to approved batches and salary-authorized users
- `tsx` business-rule tests

## Setup

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Update `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
AUTH_SECRET="use-at-least-32-characters-for-local-dev"
```

## Database

```powershell
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
```

Run `npm.cmd run prisma:generate` after schema changes if needed.

## Run

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:3000`.

## Default Local Users

All seeded users use `ChangeMe123!`.

- `super.admin@leapfrog.local` - `SUPER_ADMIN`
- `hr.admin@leapfrog.local` - `HR_ADMIN`
- `sales.head@leapfrog.local` - `SALES_HEAD`
- `shop.manager@leapfrog.local` - `SHOP_MANAGER`
- `finance@leapfrog.local` - `FINANCE_PAYROLL`
- `auditor@leapfrog.local` - `AUDITOR`

Change these credentials before any shared or production use.

## Phase 1 Features

- Authentication, users, roles, and permissions
- Organization hierarchy, departments, locations, assignments, manager history, and status history
- Employee master data with global `LSTA_0001` ID generation and manual ID validation
- Employment type/status validation and onboarding checklist
- Salary records with API redaction and restricted UI visibility
- Audit logs and basic reports/dashboard

## Phase 2 Features

- HR file import for CSV/XLS/XLSX files
- Import field mapping with editable remapping, revalidation, normalized preview, validation issue persistence, and clean-row approval
- Employee document upload, scoped view/download, soft deactivation, visibility restrictions, and audit logging
- Leave record creation and simple approval/rejection/cancellation flow
- Achievements and recognition with submission/approval
- Employee evaluations with detail workflow screens, role checks, and reporting-scope checks
- Evaluation criteria setup with role/department applicability
- Evaluation score item model prepared for detailed criteria scoring
- Phase 2 reports for imports, validation issues, documents, leave, achievements, and evaluations
- Audit logs for import, document, leave, achievement, evaluation, and criteria actions

## Phase 3 Features

- Disciplinary records with incident types, warning levels, submission/review/approval/closure, scoped access, and audit logs.
- Termination and exit workflow with approval, final payment status, clearance status, exit checklist, employee status updates, assignment closure, and linked user deactivation on completed exit.
- Transfer requests that do not update active assignments until approved and completed.
- Promotion requests that do not update role, level, or salary until approved and completed.
- Practical approval routing with workflows, steps, approval requests, actions, and approval notifications.
- Internal notifications with own-inbox access and read auditing.
- Advanced lifecycle reports for disciplinary, termination, transfer, promotion, approvals, exit clearance, final payment, repeated disciplinary records, and lifecycle summaries.
- Scoped CSV/XLSX exports for employees, disciplinary records, terminations, transfers, promotions, approvals, and advanced reports.
- Read-only employee self-service for own profile, visible documents, leave, approved achievements/evaluations, and exit status.

Phase 3 intentionally does not include payroll integration, KPI integration, biometric attendance, or external system integrations.

## Phase 4 Features

- Payroll preparation batches with payroll-ready validation, readiness counts, blocked-row exclusion, approval, CSV/XLSX export, salary-access audit logging, and export history.
- KPI foundation with configurable metrics, employee KPI result import, achievement percent calculation, rating assignment, submission, approval, and scoped visibility.
- Analytics dashboard for payroll readiness, KPI status, data quality, reminders, profile change requests, export history, and approval escalation candidates.
- Compliance dashboard for record completeness, payroll blockers, overdue reminders, profile requests, approval governance gaps, and generated findings.
- Notification preferences by category for in-app, email, and digest flags.
- Employee profile change requests for phone, address, personal email, and emergency-contact records with HR approval and audit logs.
- Approval governance fields for fallback approvers, escalation roles, escalation days, self-approval prevention, and required comments.
- Data quality issue tracking with severity, assignment, resolution, dismissal, employee scoping, and audit logs.
- HR reminders with due dates, assignment notifications, completion/cancellation, and overdue state handling.
- System settings with sensitive value redaction and audited updates.
- Export history page and API for Phase 4 export traceability.

Phase 4 does not connect to real bank, payment, biometric, payroll, KPI, or external notification providers. It prepares controlled, auditable internal workflows only.

## Phase 4.5 Features

- Evaluation compensation recommendations with salary-review and commission-review flags.
- Salary review workflow separate from salary history; salary history/current salary update only after approved completion.
- Configurable payroll rules for working days, overtime, allowances, deductions, proration, and other payroll setup values.
- PAYE tax bracket setup with effective dates and active-range overlap validation.
- Pension rule setup with employee/employer rates by employment type or role.
- Payroll attendance inputs for salary proration and overtime, with approval before payroll inclusion.
- Payroll allowances and deductions with approval gates, taxable/pre-tax flags, validation, and audit logs.
- Commission plans and commission calculations for fixed amount, percent of sales, target-based, and manual commission.
- Payroll calculation engine for prorated basic salary, overtime, allowances, approved commission, gross salary, pension, taxable income, PAYE, deductions, net salary, employer total cost, rules used, and warnings.
- Payroll preparation rows now store calculation breakdowns, warnings, blockers, and compensation totals.
- Payroll export includes compensation calculation fields and blocks unresolved payroll validation blockers.
- Payroll validation issue tracking and resolution.
- Compensation dashboard for salary review, commission, payroll warning, blocker, allowance, deduction, and employer cost summaries.
- Payroll import header mapping helpers for attendance, allowances, deductions, and commission sales imports.

Phase 4.5 still does not process payments or connect to banks, payroll providers, biometric systems, tax services, or pension systems. PAYE, pension, and overtime sample rules are development placeholders and must be verified by HR/Finance before production payroll use.

## Import Module

Supported file types:

- `.csv`
- `.xls`
- `.xlsx`

Starter columns:

- `EmployeeID`
- `Full Name`
- `Division`
- `Department`
- `Region`
- `Shop`
- `Cluster`
- `Role`
- `Level`
- `Direct Manager`
- `Evaluator`
- `Employment Type`
- `Employment Status`
- `Basic Salary`

The import preview stores normalized rows and separates validation findings into `BLOCKER`, `WARNING`, and `REVIEW`. Authorized users can edit the detected field mapping and revalidate a batch before approval. Required target fields must stay mapped. Generated employee IDs are marked as provisional review items. Approval saves valid rows (`CLEAN` and warning-only rows); blocked and review rows remain in the import batch.

## Document Visibility

- `PUBLIC_TO_HR`: visible to authorized HR users.
- `MANAGER_VISIBLE`: visible to managers within reporting scope.
- `EMPLOYEE_VISIBLE`: visible to the employee on their own profile.
- `SENSITIVE_HR_ONLY`: visible to Super Admin, HR Admin, and authorized HR users.
- `SALARY_RESTRICTED`: visible only to Super Admin, HR Admin, Finance Director, and Finance Payroll.

Documents are not permanently deleted by default; they are marked inactive.

Viewing and downloading documents goes through the document API so every access can enforce the same visibility rules and write an audit log entry.

## Workflows

Leave:

- HR creates leave records.
- Managers and employees see records within their scope.
- HR can approve, reject, or cancel without complex routing.

Achievements:

- HR and scoped managers can create recognition records.
- HR can approve or reject.
- Employees can see approved achievements in scope.

Evaluations:

- Managers can evaluate employees within reporting scope.
- HR Manager, HR Admin, CEO, and Super Admin can evaluate broadly.
- Evaluation detail pages support draft edits, submission, review, approval, and rejection based on the viewer's permissions.
- Evaluation statuses: `DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `REJECTED`.
- Ratings: `EXCELLENT`, `VERY_GOOD`, `GOOD`, `NEEDS_IMPROVEMENT`, `POOR`.

Disciplinary:

- HR and scoped managers can create records.
- Submission creates an approval request.
- HR Manager/Admin can review, approve, reject, close, or escalate based on permission.
- Employees do not see disciplinary records by default.

Termination and exit:

- HR or scoped managers can prepare resignation/termination cases.
- Approval requires a reason and last working date.
- Exit completion requires required checklist items or an HR Admin override reason.
- Exit completion marks the employee `EXITED`, ends active assignments, and disables linked user accounts.
- Final payment status is restricted to salary/finance-authorized users.

Transfers and promotions:

- Requests can be drafted and submitted without changing employee master data.
- Completion updates assignments only after approval.
- Promotion salary changes require salary update permission and create salary history when completed.

Approval routing and notifications:

- Submitted disciplinary, termination, transfer, and promotion workflows create approval requests.
- Approvers receive internal notifications.
- Requesters are notified after approval, rejection, or requested changes.

## Reports

Phase 2 reports include:

- Import history and validation issue counts
- Documents uploaded by type
- Employees missing required contract documents
- Leave by status, department, and shop
- Achievements by employee, department, and shop
- Evaluation status, rating, pending, overdue, and missing-current-period summaries

Employee-linked report data is filtered by the current user's reporting scope. Company-wide import summaries are limited to roles with company report and import visibility.

Phase 1/2 report export actions remain basic, while Phase 3 list and advanced-report exports use the scoped export API.

Advanced Phase 3 reports include disciplinary status/type, open follow-ups, termination status, exit clearance pending, final payment pending, transfer and promotion statuses, approval backlog, repeated disciplinary records, promoted/transferred employees by period, exit completion time, and lifecycle summary. CSV/XLSX exports are permissioned and scoped.

Phase 4 analytics and compliance reports are employee-scope filtered. Payroll preparation export is a separate salary-restricted flow and requires an approved payroll batch.

## Tests

```powershell
npm.cmd run test
npm.cmd run test:phase3
npm.cmd run test:phase4
npm.cmd run test:phase45
npm.cmd run test:payroll-calculation
npm.cmd run test:phase2-workflows
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The current tests cover Phase 1 rules plus Phase 2 import validation and editable mapping, salary parsing, generated provisional IDs, document visibility, leave day calculation, achievement scope, evaluation permissions, import approval permissions, Phase 3 lifecycle access/validation rules, Phase 4 payroll readiness, KPI calculations, access controls, governance validation, profile-change limits, reminder status logic, and Phase 4.5 salary review, payroll configuration validation, payroll calculation, commission calculation, and payroll import header mapping.

## Known Limitations

- Import approval saves valid rows only; review rows require a later edit-and-approve workflow.
- Import approval does not yet map department/location names into IDs.
- Document files are stored locally for development.
- Evaluation score items are modeled, but detailed criteria scoring UI is planned for expansion.
- Approval routing is intentionally practical rather than a full enterprise workflow engine.
- Disciplinary attachment upload/view/download is modeled by attachment path and audit actions but does not yet include a dedicated file upload controller.
- Transfer form currently captures the most common assignment fields; deeper location mapping can be refined later.
- Payroll preparation is an approved internal export workflow, not payroll processing or payment execution.
- KPI results are manually imported/entered; no external KPI source integration is connected.
- Notification preference email/digest flags are stored but no external email provider is connected.
- Emergency-contact profile changes are recorded and reviewed, but a dedicated emergency-contact table is not yet modeled.
- Tiered commission data is modeled, but complex tiered calculation is deferred.
- Payroll import preview helpers exist; full commit workflows for all payroll import types are deferred.
- PAYE/pension/overtime seed values are development examples and not production statutory advice.
- Phase 4.5 migration must be applied before DB-backed compensation screens can be used.
- Recursive reporting-scope expansion is still limited.

## Phase 3 Permissions

New permissions include:

- `disciplinary.view/create/update/submit/review/approve/close`
- `termination.view/create/update/submit/review/approve/complete_exit/update_final_payment`
- `transfer.view/create/update/submit/approve/complete`
- `promotion.view/create/update/submit/approve/complete`
- `approval.view/configure/act`
- `notification.view/manage`
- `export.create`
- `self_service.view`

## Phase 4 Permissions

New permissions include:

- `payroll_preparation.view/create/validate/approve/export`
- `kpi.view/create/update/import/approve`
- `analytics.view`
- `compliance.view`
- `notification_preferences.manage`
- `self_service.profile_update_request`
- `profile_change_request.view/approve`
- `approval_governance.configure`
- `data_quality.view/assign/resolve`
- `reminder.view/create/complete`
- `system_settings.view/update`
- `export_history.view`

## Phase 4.5 Permissions

New permissions include:

- `salary_review.view/create/update/review/approve/complete`
- `payroll_rule.view/create/update/deactivate`
- `paye_tax.view/manage`
- `pension_rule.view/manage`
- `payroll_attendance.view/create/approve`
- `payroll_allowance.view/create/approve`
- `payroll_deduction.view/create/approve`
- `commission_plan.view/create/update/approve`
- `commission_calculation.view/create/update/review/approve/export`
- `payroll_calculation.view/run`
- `payroll_validation.view/resolve`
- `compensation_dashboard.view`

## Pre-Phase 5 HRIS Alignment Hardening

Phase 4.5 compensation and payroll features now include an explicit pre-production governance layer. Payroll, PAYE, pension, overtime, working-day, allowance, deduction, and commission rules must be effective-dated, active, non-sample, and `APPROVED` before production payroll calculation can use them. Draft, submitted, rejected, deactivated, expired, or sample rules are treated as setup problems and payroll preparation/calculation surfaces this warning: `Payroll rules must be verified and approved by HR/Finance before production payroll use.`

Payroll rule changes capture creator/reviewer/approver identifiers, effective start/end dates, approval status, change reason, sample status, and timestamps. Seeded development payroll values are sample/draft only and are not production-approved statutory advice.

Required employee document rules are configurable by employment type, role, department, or division. Default rules cover full-time, part-time, commission-based, shop manager, finance, and HR document expectations. Missing required documents generate business-readable compliance/data-quality findings and should be resolved before activation or payroll processing where company policy requires a block.

### HR/Finance Production Readiness Checklist

1. Confirm company structure.
2. Confirm roles and permissions.
3. Confirm employment types.
4. Confirm required document rules.
5. Confirm PAYE brackets.
6. Confirm pension employee and employer rates.
7. Confirm overtime rates.
8. Confirm allowance rules.
9. Confirm deduction rules.
10. Confirm commission plans.
11. Confirm payroll approval users.
12. Confirm payroll export format.
13. Confirm salary visibility roles.
14. Confirm audit log review process.
15. Confirm backup/export policy.
16. Confirm user onboarding and deactivation process.

### Alignment Notes

- Employee master data, assignments, status history, salary history, salary reviews, evaluations, commission calculations, payroll preparation, payroll calculation, exports, approvals, and audit logs remain separate modules.
- Evaluations and commission calculations do not directly update salary. Salary changes should flow through salary review approval and salary history.
- Payroll exports exclude blocked rows and require approved/exportable payroll batches.
- Sensitive salary, commission, payroll, PAYE, pension, disciplinary, termination, document, and audit surfaces use backend permissions; frontend hiding is not treated as sufficient control.
- Reports and compliance views filter employees through role/scope checks.
- Phase 5 should focus on integration and automation only after HR/Finance approves live payroll rules, confirms export formats, and reviews audit/reporting responsibilities.

## Phase 5 Integration, Automation, and Production Readiness

Phase 5 adds the safe production-readiness layer without connecting to banks, government systems, telecom systems, pension providers, tax services, or external payroll processors.

### Payroll Export Templates and Runs

Payroll export templates map internal approved payroll fields to CSV, XLSX, or JSON layouts for internal finance, bank-template, accounting-system, payroll-system, or custom targets. Exports still require approved payroll batches, exclude blocked rows, preserve export metadata, audit export actions, and record a `PayrollExportRun`. Exports do not trigger payments.

### Payroll Locks and Adjustments

Payroll periods can be locked after approval/export. Locked periods block direct attendance edits through Phase 5 attendance entry and route historical corrections to payroll adjustments. Unlocking requires permission and a reason. Adjustments support positive or negative corrections and approval status before future payroll inclusion.

### Attendance and Leave Balance

Attendance records track employee/date status, hours, overtime, source, approval, and notes. Attendance import preview validates employee IDs, dates, statuses, and duplicate employee/date rows before commit. Leave policies, balances, and balance adjustments provide the foundation for accruals, approved leave usage, and employee/manager visibility.

### KPI Automation and Evaluation Linkage

KPI import templates define reusable field mappings. KPI evaluation weights link approved KPI results to evaluation scoring support without overwriting evaluation comments. Weight validation ensures valid percentages and can enforce a 100% total.

### Self-Service and Manager Self-Service

Employee self-service remains self-only and cannot directly edit salary, role, manager, department, status, or assignment. Manager self-service adds team dashboard, team attendance, and team leave views limited to direct/reporting scope. Salary and payroll summary visibility still requires salary/payroll permissions.

### Email Notifications

Email templates and delivery logs are modeled. Email delivery is disabled by default unless `EMAIL_DELIVERY_ENABLED=true` and safe delivery configuration is provided. Templates are validated to avoid exposing restricted salary, payroll, disciplinary, termination, or commission fields to unauthorized recipients.

### Security, Retention, and Integrations

Password policy validation requires length, upper/lowercase, number, and symbol. Failed logins are audited and can lock accounts via `FAILED_LOGIN_LOCKOUT_THRESHOLD` and `FAILED_LOGIN_LOCKOUT_MINUTES`. Security reports summarize failed login, permission, export, and audit activity. Retention policies default to review/keep governance and do not automatically delete core HR records. Integration tokens store only SHA-256 token hashes, require scopes, can expire, and do not bypass RBAC. Integration event logs are safe placeholders; outbound webhooks are not sent.

### Production Readiness and Health

Production readiness checklist and system health screens cover environment variables, migrations, seed data, admin creation, backup/restore, file storage, email configuration, payroll rule confirmation, role review, security review, audit review, export permission review, deployment steps, rollback plan, database reachability, email status, and approved payroll-rule counts.

### Phase 5 Permissions

New permissions include `payroll_export_template.*`, `payroll_lock.*`, `payroll_adjustment.*`, `attendance.*`, `leave_policy.*`, `leave_balance.*`, `kpi_import_template.*`, `kpi_evaluation_linkage.manage`, `self_service.leave_request`, `self_service.resignation_request`, `manager_dashboard.view`, `team_attendance.view`, `team_leave.view`, `email_template.*`, `email_log.view`, `security_settings.*`, `security_reports.view`, `data_retention.*`, `integration_token.*`, `integration_event.view`, `production_readiness.view`, and `system_health.view`.

Run Phase 5 tests with:

```bash
npm run test:phase5
```

Known Phase 5 limitations:

- Attendance import commit is still intentionally separated from preview for review safety.
- Email delivery is mocked/logged unless explicitly enabled and configured.
- Integration tokens and event logs are foundations only; external endpoints remain restricted.
- Leave balance accrual automation is foundational; scheduled accrual jobs are deferred.
- 2FA is a disabled placeholder, not a forced authentication requirement.

Recommended Phase 6 next steps:

- Background jobs for leave accruals, reminders, email queues, and retention review reminders.
- Optional approved email provider configuration.
- Optional controlled external KPI/payroll import adapters.
- Stronger production deployment automation and observability.
- Full 2FA enrollment and recovery flow if the company wants to require it.

## Recommended Next Phase

- Signed URLs and richer attachment handling for sensitive lifecycle documents
- Leave balance policy and accruals
- Dedicated emergency-contact model and richer employee self-service change types
- Optional external payroll/KPI/provider integrations behind explicit integration approvals
- Full payroll import preview/commit screens for attendance, allowance, deduction, and commission files
- Tiered commission calculation engine
- Database-level partial unique index for active assignments
- Advanced approval delegation/escalation SLA automation
