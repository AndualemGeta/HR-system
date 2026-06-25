# Missing Features & Architecture Gaps Report

> Generated after full repository analysis of the Leapfrog HR Management System.
> Date: 2026-06-25

---

## 1. System Map

| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | TypeScript, React 19, Server Components |
| **Database** | PostgreSQL via Prisma ORM | Full schema with 50+ models, 80+ enums |
| **Auth** | JWT (jose) + httpOnly cookies | 8h expiry, bcryptjs password hashing (12 rounds) |
| **Validation** | Zod | Schema validation on all API inputs |
| **Frontend** | React 19, Lucide icons, Tailwind CSS | Layout shell + 70 page routes under `(app)/` |
| **API** | REST via Next.js route handlers | 60 API route groups under `src/app/api/` |
| **Testing** | tsx-based business-rule tests | Phase 1–5 test scripts in `src/test/` |
| **Storage** | Local filesystem (`uploads/`) | Document uploads, seeded with dev data |

### Modules Present (by phase)

- **Phase 1**: Users, roles, permissions, organization hierarchy, departments, locations, employee master data, assignments, onboarding checklists, salary records, basic reports
- **Phase 2**: CSV/XLSX import with field mapping & validation, employee documents & visibility rules, leave records, achievements, evaluations, evaluation criteria, Phase 2 reports
- **Phase 3**: Disciplinary records, termination & exit workflows, transfers, promotions, approval routing engine, notifications, exports, self-service, Phase 3 reports
- **Phase 4**: Payroll preparation batches, KPI metrics & results, analytics dashboard, compliance dashboard, notification preferences, profile change requests, approval governance, data quality issues, HR reminders, system settings
- **Phase 4.5**: Salary reviews, payroll rules, PAYE brackets, pension rules, payroll attendance/allowances/deductions, commission plans & calculations, payroll calculation engine, compensation dashboard
- **Phase 5**: Payroll export templates & runs, payroll locks & adjustments, attendance records, leave policies & balances, KPI import templates & evaluation weights, email templates & delivery logs, self-service & manager dashboards, security settings & reports, data retention policies, integration tokens & event logs, production readiness & system health

---

## 2. Critical Security Gaps

### 2.1 Authentication Weaknesses

| Gap | Severity | Details |
|---|---|---|
| **No Multi-Factor Authentication (2FA/MFA)** | **HIGH** | README calls it a "disabled placeholder" but absolutely zero code exists. HR systems with salary/PII data require 2FA for all users, especially admins. |
| **No Password Reset / Forgot Password Flow** | **HIGH** | `passwordChangeRequired` field exists on the User model but no API route or UI for password reset, forgot password, or self-service password change. |
| **No Rate Limiting on Login** | **MEDIUM** | Account lockout after N failed attempts is implemented, but there is no request-level rate limiting. A distributed brute-force could still hit many accounts. |
| **Session Token Fixed 8h Expiry** | **MEDIUM** | No refresh token mechanism, no sliding session expiry, no absolute max session lifetime. Once a token is stolen, it is valid for 8 hours. |
| **No Email Verification** | **MEDIUM** | User accounts can be created without verifying email ownership. The `email` field accepts any valid format. |

### 2.2 Web Security Gaps

| Gap | Severity | Details |
|---|---|---|
| **No CSRF Protection** | **HIGH** | Session cookie has `sameSite: "lax"` but there is no CSRF token mechanism anywhere. Any cross-site request could trigger state changes. |
| **No Content Security Policy (CSP)** | **MEDIUM** | No CSP headers set in `next.config.mjs` or middleware. XSS risks are unmitigated at the header level. |
| **No Middleware Layer** | **MEDIUM** | No `middleware.ts` file. All route protection is done inline per API handler. No centralized path-based security, header injection, or request inspection. |
| **No Security Headers** | **MEDIUM** | Missing `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`. Only the cookie-level `secure` flag (production) is present. |
| **No Request Size Limits Beyond 8MB** | **LOW** | Only body size limit for server actions. No input sanitization or request size validation on API routes. |

### 2.3 Data Privacy / PII Gaps

| Gap | Severity | Details |
|---|---|---|
| **No PII Classification Schema** | **HIGH** | No metadata marking fields as PII, sensitive, or confidential at the schema level. Salary, DOB, phone, address, emergency contacts are stored without sensitivity tags. |
| **No Encryption at Rest for Sensitive Columns** | **HIGH** | Salary data, DOB, phone numbers, addresses are stored as plaintext in the database. No application-level encryption for PII columns. |
| **No Data Masking on API Responses** | **MEDIUM** | Salary is redacted via permission checks, but other PII fields (phone, address, DOB, emergency contact) are returned freely when the user has `employee.view`. No partial masking. |
| **No DSAR (Data Subject Access Request) Workflow** | **MEDIUM** | No mechanism for employees to request their complete data export or deletion under data privacy regulations. |
| **No Consent Tracking** | **MEDIUM** | No records of employee consent for data processing, document storage, or data sharing. |
| **Emergency Contact in Main Employee Table** | **LOW** | Emergency contact is stored as a profile change request field, not in a dedicated `EmergencyContact` model with proper relational structure. |
| **No Retention Enforcement** | **MEDIUM** | `DataRetentionPolicy` model exists, but no automated job enforces retention periods. `actionAfterRetention` defaults to `REVIEW_REQUIRED`. |

---

## 3. Architectural Gaps

| Gap | Impact | Details |
|---|---|---|
| **No Soft-Delete Pattern** | **MEDIUM** | Only `EmployeeDocument.isActive` implements soft-delete. All other models use hard deletes or status-based lifecycle. No `deletedAt` / `deletedById` pattern. |
| **No Event-Driven / Background Job System** | **HIGH** | Notifications, audit logs, email delivery (flagged "mocked/logged"), leave accruals, reminders, retention enforcement all either happen synchronously or are deferred. No queue/bull/worker infrastructure. |
| **No Caching Layer** | **MEDIUM** | Every request hits Prisma/PostgreSQL directly. No Redis or in-memory cache for frequently accessed data (organization tree, roles/permissions, employee lookups). |
| **No API Versioning** | **LOW** | All routes are at `/api/`. Any breaking schema change requires simultaneous frontend/backend deployment. |
| **No Structured Logging** | **MEDIUM** | Catch blocks use `console.error`. Prisma logs only warnings/errors in dev. No structured JSON logging, no log levels, no log shipping. |
| **No Instrumentation / APM** | **LOW** | No performance monitoring, no OpenTelemetry, no request tracing. Debugging production issues would be difficult. |
| **No Recursive Scope Expansion** | **MEDIUM** | Reporting scope only checks direct relationships (direct manager, direct department/region/shop). Multi-level hierarchy traversal is not implemented. |
| **No Database Constraints for Active Assignments** | **LOW** | README notes missing "partial unique index for active assignments" meaning an employee could theoretically have multiple active assignments simultaneously. |
| **No Graceful Error Handling for Users** | **LOW** | No frontend error boundaries. API errors return raw messages that may leak implementation details. |

---

## 4. Missing Functional Features

### Core HR Modules Not Present

| Module | Priority | Notes |
|---|---|---|
| **Employee Offboarding Workflow** | **HIGH** | Termination exists but there is no structured offboarding/rehire process. Once `EXITED`, there is no path back to `ACTIVE` for rehire. |
| **Automated Leave Accruals** | **MEDIUM** | `LeaveAccrualMethod` and `LeaveBalance` models exist, but no scheduled job computes accruals. Balances must be manually adjusted. |
| **Employee Self-Service Leave Requests** | **MEDIUM** | `self_service.leave_request` permission exists but leave is still created by HR. The "Recommended Next Phase" section confirms leave balance policy/accruals as deferred. |
| **Loan & Advance Management** | **MEDIUM** | `DeductionType.LOAN_DEDUCTION` and `ADVANCE_DEDUCTION` exist, but there is no loan origination, repayment schedule, or advance tracking workflow. |
| **Training & Development** | **MEDIUM** | No training records, certification tracking, skills matrix, or development plan module. |
| **Recruitment / Applicant Tracking** | **MEDIUM** | No job postings, applicant pipeline, interview scheduling, or offer management. |
| **Benefits Administration** | **MEDIUM** | No health insurance, pension plan enrollment, or other benefits management beyond basic payroll pension deductions. |
| **Contract Renewal Automation** | **LOW** | `Contract` document type exists, but no workflow for tracking contract end dates and triggering renewals. |
| **Organizational Chart Visualization** | **LOW** | Org structure exists in data but no visual org chart rendering. |
| **Travel & Expense Management** | **LOW** | No expense report submission, approval, or reimbursement workflow. |

### Self-Service & UX Gaps

| Gap | Details |
|---|---|
| **Employee cannot upload their own documents** | Documents are uploaded by HR only. |
| **No self-service password change** | Not even for authenticated users. Requires HR admin to create/reissue accounts. |
| **No dashboard customization** | Dashboards are fixed per role. Users cannot customize widgets or save report filters. |
| **No mobile-responsive guarantee** | Appears to be desktop-first. No mobile-specific considerations found. |

---

## 5. Technical Debt (Codex Scaffolding Leftovers)

### Code Quality Issues

| Location | Issue | Severity |
|---|---|---|
| `src/app/api/employees/route.ts:270` | `as never` type assertion for `payload.employmentType` | Medium |
| `src/app/api/employees/route.ts:119` | `employee.employmentStatus` cast as `never` for Prisma enum filter | Medium |
| `src/app/api/users/route.ts:55` | `as never` type assertion for role name | Medium |
| `src/app/api/employees/route.ts:405` | `console.error` instead of structured logging | Low |
| `prisma/schema.prisma` | Duplicate LeaveType enum values: `ANNUAL`/`ANNUAL_LEAVE`, `SICK`/`SICK_LEAVE`, etc. | Low |
| `src/lib/constants.ts:827-1124` | `rolePermissions` is manually maintained; could become out of sync with DB seed | Medium |
| Various API routes | Inline validation schemas repeated across many files instead of shared schema library | Medium |

### Test Coverage Gaps

| Area | Status |
|---|---|
| Payroll calculation engine | No automated tests (despite complex math for proration, PAYE, pension, overtime) |
| Commission calculation engine | No automated tests |
| Approval routing workflow | No workflow integration tests |
| Frontend component tests | Zero component tests found |
| E2E tests | Zero E2E tests found |
| Security tests (rate limiting, CSRF, 2FA) | No security-specific tests |

### Configuration / Environment Issues

| Issue | Details |
|---|---|
| **Seed password hardcoded** | All 6 seed users use `ChangeMe123!` — visible in README and seed file |
| **Local upload directory** | `./storage/uploads` is not suitable for production (no S3/cloud storage) |
| **Phase 4.5 migration not applied** | README states "Phase 4.5 migration must be applied before DB-backed compensation screens can be used" |
| **No production Dockerfile** | No containerization setup found |
| **`.env.example` has placeholder values** | `AUTH_SECRET` example says "replace-with-at-least-32-random-characters" — easy to miss in production |

---

## 6. Recommendations (Priority Order)

### Immediate (Security-critical)
1. **Implement CSRF protection** — Add double-submit cookie pattern or SameSite=Strict + CSRF tokens
2. **Add a middleware.ts** — For centralized security headers (CSP, HSTS, X-Frame-Options) and path-based access checks
3. **Rate limit the login endpoint** — At minimum per-IP with something like `express-rate-limit` pattern or a reverse proxy
4. **Encrypt PII columns at rest** — Use Prisma middleware or database-level encryption for salary, DOB, phone, address

### Short-term (Architecture)
5. **Add soft-deletes** — `deletedAt` + `deletedById` on core entities (Employee, Department, Location)
6. **Create a background job infrastructure** — Start with in-process jobs, plan for queue-based workers
7. **Fix duplicate LeaveType enums** — Consolidate `ANNUAL`/`ANNUAL_LEAVE`, `SICK`/`SICK_LEAVE`, etc.
8. **Extract shared validation schemas** — Move Zod schemas to a shared `src/lib/schemas/` directory
9. **Add structured logging** — Replace `console.error` with a logging utility (pino, winston, or a custom logger)

### Medium-term (Features)
10. **2FA/MFA** — Implement TOTP-based 2FA with recovery codes for all roles with salary access
11. **Password reset flow** — Email-based reset with time-limited tokens
12. **Automated leave accruals** — Scheduled job using `LeaveAccrualMethod` on `LeavePolicy`
13. **Employee self-service leave requests** — Enable the existing `self_service.leave_request` permission flow
14. **Loan & advance management** — Full repayment schedule tracking integrated with payroll deductions
15. **Organizational chart** — Visual hierarchy from existing `OrganizationUnit` / `Department` / `Location` data

### Long-term (Strategy)
16. **Background jobs** — For leave accruals, reminders, email queues, data retention enforcement
17. **Database constraints** — Partial unique index for active assignments
18. **Recursive scope expansion** — Multi-level manager/reporting hierarchy traversal
19. **API versioning** — Namespace routes under `/api/v1/`, `/api/v2/`
20. **Caching layer** — Redis for session store, permission lookups, organization tree
21. **Cloud file storage** — Replace local `uploads/` with S3-compatible object storage
22. **E2E test suite** — Playwright or Cypress for critical employee lifecycle flows
