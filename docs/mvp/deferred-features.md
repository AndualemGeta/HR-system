# Deferred Features (Post-MVP)

These features exist in the codebase but are deferred from the initial MVP launch.
Working code is preserved; features are hidden from navigation and not part of the
production workflow.

## Deferred Until Payroll Excel Is Validated

| Feature | Reason | Code Location |
|---------|--------|---------------|
| Payslips | Requires validated payroll output | `src/app/payslips/`, `src/lib/payroll/payslip.ts` |
| Payment Batches | Requires bank/MPESA integration | `src/app/payment-batches/` |
| Statutory Reports | Requires e-filing integration | `src/app/statutory-reports/` |
| Payroll Journals | Requires accounting integration | `src/app/payroll-journals/` |
| Payment Reconciliation | Requires bank feed | Phase 5B models |

## Deferred - Advanced Payroll Features

| Feature | Reason |
|---------|--------|
| Advanced payroll calculation engine | Complex; not needed for manual Excel prep |
| Generic pay rules engine | Over-engineered for current needs |
| Pay component assignments | Part of calculation engine |
| Payroll input types/requirements/waivers | Complex data collection workflow |
| Payroll proration | Requires attendance integration |
| Shop Manager Incentives | Separate business domain |

## Deferred - HR Features

| Feature | Reason |
|---------|--------|
| Onboarding checklist | Not critical for payroll |
| Employee evaluations | Separate process |
| Disciplinary records | Separate process |
| Termination cases | Manual process suffices |
| Transfer/Promotion requests | Manual process suffices |
| Commission plans | Simple manual entry handles this |
| Leave management | Requires attendance integration |
| Attendance tracking | No integration available |
| KPI engine | Part of incentive calculation |
| Document management | File storage not critical for MVP |
| Data quality dashboard | Manual review suffices |
| Change requests | Employee changes are direct (with audit) |
| Phase control checklist | Internal project management |
| Employee profile change requests | Direct editing suffices (with audit) |

## Deferred - Integration Features

| Feature | Reason |
|---------|--------|
| Bank API | No integration contract |
| M-PESA API | No integration contract |
| Statutory e-filing | No integration contract |
| General KPI engine | Not scoped |
| Attendance integration | No time system |
| Leave integration | Not scoped |
| Accounting journals | Not scoped |
| Payment reconciliation | Not scoped |
