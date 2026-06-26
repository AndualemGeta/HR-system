# Leapfrog HR Management System

Clean rebuild of the Leapfrog HR Management System — a secure, role-based HRIS for Leapfrog Software Technology Africa PLC.

## Tech Stack

- Next.js App Router + TypeScript
- Prisma ORM + PostgreSQL
- Email/password auth with JWT (jose) + HTTP-only session cookies
- Role-based access control (RBAC) with 53 granular permission keys
- bcryptjs password hashing (12 rounds)
- Zod request validation
- Audit logging for all sensitive actions

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Update `.env` with your PostgreSQL connection string and a secure `AUTH_SECRET`.

## Database

```powershell
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

## Run

```powershell
npm run dev
```

Open `http://127.0.0.1:3000`.

## Default Users

| Email | Password | Role |
|---|---|---|
| `admin@leapfrog.com` | `Admin123!` | SUPER_ADMIN |
| `hr@leapfrog.com` | `Hr123!` | HR_MANAGER |

## What's Built

### Foundation
- Authentication (login/logout/me) with account lockout after 5 failed attempts
- Session management via signed JWTs in HTTP-only cookies
- Role-based access control (5 roles: SUPER_ADMIN, HR_MANAGER, HR_OFFICER, MANAGER, EMPLOYEE)
- 53 granular permissions covering all HR domains
- Audit logging for all sensitive actions
- Prisma schema (~40 models) covering all business domains

### HR Core
- Employee master data with auto-generated IDs (`LSTA_0001`, `LSTA_0002`, ...)
- Employee CRUD API with pagination, search, and filtering
- Department and Location hierarchy with self-referencing trees
- Organisation chart view with expandable department tree

### Models Ready (schema + DB)
- User, Role, Permission, UserRole, RolePermission
- Employee, EmployeeAssignment, EmployeeStatusHistory
- Department, Location
- OnboardingChecklist, OnboardingChecklistItem
- EmployeeDocument, RequiredDocumentRule
- LeaveRecord, LeavePolicy, LeaveBalance, LeaveBalanceAdjustment
- EmployeeEvaluation, Achievement
- DisciplinaryRecord, TerminationCase
- TransferRequest, PromotionRequest
- ApprovalWorkflow, ApprovalStep, ApprovalRequest, ApprovalAction
- Notification
- EmployeeSalary, SalaryReview
- CommissionPlan, CommissionCalculation
- PayrollRule, PayeTaxBracket, PensionRule
- PayrollAttendanceInput, PayrollAllowance, PayrollDeduction
- PayrollPreparationBatch, PayrollPreparationRow, PayrollPeriodLock, PayrollAdjustment
- KpiMetric, AttendanceRecord, DataQualityIssue
- EmployeeProfileChangeRequest
- SystemSetting, ExportHistory

## Build Verification

```powershell
npm run typecheck
npm run lint
npm run build
```

All pass clean.

## Key Design Decisions

- Employee IDs use the `LSTA_NNNN` format with a never-resetting sequence
- All monetary fields use `@db.Decimal` with appropriate precision
- Self-referencing models (Department, Location, Employee) use explicit `@relation` annotations
- All relations are bidirectional (no orphan relation fields)
- Permissions are checked server-side; frontend only controls navigation visibility
- Document visibility scoped: PUBLIC_TO_HR, MANAGER_VISIBLE, EMPLOYEE_VISIBLE, SENSITIVE_HR_ONLY, SALARY_RESTRICTED
- Comprehensive enums for LeaveType, AllowanceType, DeductionType, CommissionCalculationType, etc.

## Next Build Targets

1. Leave request API + self-service page
2. Document upload API + self-service page
3. Employee evaluation API + page
4. Disciplinary / termination / transfer / promotion routes
5. Approval workflow engine
6. Payroll preparation and calculation
7. Reports and dashboards
