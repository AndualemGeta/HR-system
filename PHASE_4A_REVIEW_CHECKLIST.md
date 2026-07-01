# Phase 4A — Payroll Period Setup and Monthly Input Collection — Review Checklist

## Payroll Period
- [ ] HR Admin can create payroll period
- [ ] Finance Payroll can create payroll period
- [ ] Employee cannot create payroll period
- [ ] Only one OPEN_FOR_INPUT period is allowed (API-enforced)
- [ ] Cannot edit period dates after opening (API-enforced)
- [ ] Can close input collection
- [ ] Can cancel draft period

## Employee Selection
- [ ] Eligible employees loaded correctly (ACTIVE, ON_PROBATION, ONBOARDING)
- [ ] Inactive/terminated employees excluded by default
- [ ] Payroll readiness status shown
- [ ] Employee can be added to payroll period
- [ ] Employee can be removed while period is draft
- [ ] Employee scope rules respected (ASM, Shop Manager)

## Input Type
- [ ] 8 default input types seeded
- [ ] HR Admin can create input type
- [ ] HR Admin can update input type
- [ ] Employee cannot manage input types
- [ ] Inactive input type prevented from new inputs

## Monthly Input
- [ ] Authorized user can create input record
- [ ] Input can be saved as draft
- [ ] Input can be submitted
- [ ] Submitted input can be accepted
- [ ] Submitted input can be rejected (with reason stored)
- [ ] Employee cannot create input
- [ ] Import preview validates employeeId, inputTypeCode, duplicates
- [ ] Import confirm creates valid rows, skips invalid
- [ ] Import modes: CREATE_ONLY, UPDATE_DRAFT_ONLY, SKIP_EXISTING

## Permissions
- [ ] SUPER_ADMIN has full access
- [ ] HR_ADMIN has full Phase 4A access
- [ ] HR_OFFICER has limited view/create access
- [ ] FINANCE_DIRECTOR has view/open/close/review/export
- [ ] FINANCE_PAYROLL has create/update/submit/review/import/export
- [ ] SALES_HEAD has view/create/submit for shop/field scope
- [ ] ASM has view/create/submit for assigned area scope
- [ ] SHOP_MANAGER has view/create/submit for own shop scope
- [ ] EMPLOYEE has no Phase 4A access
- [ ] AUDITOR has view-only access

## Quality Gates
- [ ] npm run typecheck passes
- [ ] npm run lint passes
- [ ] npm run build passes
- [ ] npm run test:phase4a passes (35 tests)
- [ ] npm test passes (all phases)
