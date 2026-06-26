# Starter Workflow Build Status Report

> Generated: 2026-06-26
> Build: Employee Registration Starter — Head Office + Shop/Field

## Implemented

| Module | Status | Details |
|---|---|---|
| Authentication | DONE | Login, logout, session, account lockout, audit |
| RBAC | DONE | 12 roles with 20 permission keys |
| Employee Registration Flow | DONE | Two-step: category selection → category-specific form |
| Head Office Registration | DONE | Department, position/role, direct manager; no shop/cluster required |
| Shop/Field Registration | DONE | Region/area, shop, role; role-based default managers |
| Shop Accountant Dual Reporting | DONE | Operational shop + accounting reporting manager (defaults to HO Treasury) |
| Employee Profile | DONE | Category badge, org info, assignments, status history, onboarding, salary |
| Employee List | DONE | Search, filter by category, pagination |
| Organization Data | DONE | 6 departments, 1 region, 2 areas, 6 shops (Ethiopia) |
| Employee CRUD API | DONE | Create (auto ID LSTA_NNNN), update with audit |
| Assignments | DONE | Auto-created on employee creation; history preserved |
| Status History | DONE | Recorded on creation and update |
| Onboarding Checklists | DONE | Auto-created for DRAFT/ONBOARDING employees |
| Salary Access Control | DONE | salary.view required; REDACTED in API for unauthorized |
| Audit Logging | DONE | Employee create/update, status change, salary change, manager change, accounting manager change, login |
| Page Guards | DONE | All pages check auth + required permissions |
| Navigation | DONE | Permission-filtered by role group |
| Tests | DONE | 42 tests covering auth, RBAC, HO registration, Shop/Field registration, salary visibility, assignments, audit, org data |
| Seed Data | DONE | 11 users, 16 employees, Ethiopia-oriented, no Kathmandu |
| Quality Gates | DONE | Typecheck ✓, Lint ✓, Build (26 routes) ✓, Tests (42/42) ✓ |

## Schema-Only (No APIs, Pages, or Tests — Planned for Later Phases)

These models exist in the Prisma schema but have no implementation in this starter build:

- EmployeeDocument, RequiredDocumentRule
- LeaveRecord, LeavePolicy, LeaveBalance, LeaveBalanceAdjustment
- EmployeeEvaluation, Achievement
- DisciplinaryRecord
- TerminationCase
- TransferRequest, PromotionRequest
- ApprovalWorkflow, ApprovalStep, ApprovalRequest, ApprovalAction
- Notification
- SalaryReview
- CommissionPlan, CommissionCalculation
- PayrollRule, PayeTaxBracket, PensionRule
- PayrollAttendanceInput, PayrollAllowance, PayrollDeduction
- PayrollPreparationBatch, PayrollPreparationRow, PayrollPeriodLock, PayrollAdjustment
- KpiMetric, AttendanceRecord, DataQualityIssue
- EmployeeProfileChangeRequest
- SystemSetting, ExportHistory

## Not Implemented (Planned for Later Phases)

- Document upload/management
- Leave management
- Employee evaluations
- Payroll preparation/calculation
- Commission plans/calculations
- Disciplinary workflows
- Termination/exit workflows
- Transfer/promotion workflows
- Approval routing engine
- Notifications
- PAYE tax/pension rules
- Employee/manager self-service
- External integrations
- CSV/XLSX import
- KPI tracking

## Known Limitations & Issues

- Manager scope (ASM sees own area, Shop Manager sees own shop) is not yet enforced at API query level — all employees are visible via the list API
- Employee registration form lacks file/document upload
- No email delivery configured
- No self-service employee/manager views
- Shop Accountant API defaults accounting reporting manager only if not provided; does not still have explicit validation at edit time
- Employee profile shows raw location IDs instead of names (no location name resolver)

## Recommendation

**READY FOR STARTER USER REVIEW** — The employee registration workflow for Head Office and Shop/Field employees is complete, tested, and verified. All quality gates pass. Reviewers should follow `USER_REVIEW_GUIDE.md` for test scenarios.
