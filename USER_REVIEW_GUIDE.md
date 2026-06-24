# Leapfrog HRMS Controlled User Review Guide

## 1. Review Purpose

This review is for HR, Finance/Payroll, managers, and employees to validate workflows, permissions, navigation, data visibility, and review readiness before broader rollout. It is not a production go-live approval.

## 2. Ready For Review

- Role-based navigation and page guards.
- Employee master data and onboarding.
- Documents, leave, achievements, evaluations, disciplinary, termination, transfers, and promotions.
- Salary review, payroll preparation, PAYE/pension/payroll rules, payroll warnings, commission calculations, and payroll export templates.
- Audit logs, reports, compliance, data quality, security reports, and system settings.
- Self-service profile view, profile change requests, notifications, and scoped manager pages.

## 3. Not Enabled Yet

- External integrations are foundation only.
- Real email delivery is not enabled for this review.
- Biometric attendance is not connected.
- Payment processing is not connected.
- Full automated leave accrual jobs are deferred.
- 2FA is a disabled placeholder.
- Payroll import commit flows remain preview/foundation only where marked.
- Complex tiered commission calculation is deferred.

## 4. Demo Users And Roles

All seeded users use `ChangeMe123!` until changed locally.

- `super.admin@leapfrog.local` - `SUPER_ADMIN`
- `hr.admin@leapfrog.local` - `HR_ADMIN`
- `sales.head@leapfrog.local` - `SALES_HEAD`
- `shop.manager@leapfrog.local` - `SHOP_MANAGER`
- `finance@leapfrog.local` - `FINANCE_PAYROLL`
- `auditor@leapfrog.local` - `AUDITOR`

## 5. Suggested HR Workflow

1. Create an employee.
2. Complete onboarding.
3. Upload a document.
4. Create an evaluation.
5. Create a salary review if authorized.
6. View compliance and data quality dashboards.

## 6. Suggested Finance Workflow

1. Review salary visibility.
2. Check PAYE and pension rules.
3. Prepare a payroll batch.
4. Run payroll calculation.
5. Review blockers and warnings.
6. Export an approved payroll batch.

## 7. Suggested Manager Workflow

1. View team dashboard.
2. Submit an evaluation.
3. View team leave and attendance.
4. Create an achievement.
5. Confirm out-of-scope employees and payroll/security links are hidden.

## 8. Suggested Employee Workflow

1. View self-service profile.
2. View own documents.
3. Submit a profile change request.
4. View notifications.
5. Confirm admin, payroll, security, and audit links are hidden.

## 9. Known Limitations

- Local uploaded files are for development review only.
- Department and location IDs are still entered directly in some admin forms.
- Recursive reporting-scope expansion is limited to the current stored scope values.
- Email templates and logs are reviewable, but no email provider is connected by default.
- Payroll exports create files only; they do not send money or connect to banks.
- PAYE, pension, overtime, allowance, deduction, and commission rules require HR/Finance verification before production payroll use.

## 10. Feedback Questions

- Which workflow labels or page names are unclear?
- Which steps feel risky for HR review?
- Which payroll warnings or blockers need clearer wording?
- Are salary, payroll, audit, and security links hidden for the right roles?
- Are managers limited to the correct employees?
- What must be resolved before a second review round?
