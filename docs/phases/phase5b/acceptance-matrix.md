# Phase 5B — Acceptance Matrix

## Step 0: Phase 5A Carryover Stabilization

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-001 | CI seed creates every required test user with one documented password | login passwords match seeded hash | Unit | `npm run test:phase5a` | IMPLEMENTED BUT NOT VERIFIED |
| P5B-002 | HTTP E2E uses valid API payloads and no direct workflow-state changes | no direct Prisma mutations | E2E | `npm run test:phase5a-e2e` | IMPLEMENTED BUT NOT VERIFIED |
| P5B-003 | Playwright TEST_BASE_URL matches server port | baseURL = port 3003 | Config | `npx playwright test` | VERIFIED LOCALLY |
| P5B-004 | KPI assignment test runner executes correct test file | runner points to existing file | Config | `npm run test:kpi-assignment` | IMPLEMENTED BUT NOT VERIFIED |
| P5B-005 | Calculation-mode UI values match API enums | category/valueType match schema | Unit | `npm run test:phase5a` | IMPLEMENTED BUT NOT VERIFIED |
| P5B-006 | PATCH validates merged calculationMode/valueType state | superRefine on PATCH route | Unit | `npm run test:phase5a` | IMPLEMENTED BUT NOT VERIFIED |
| P5B-007 | Manual, calendar-day and working-day proration correct | proration tests pass | Unit | `npm run test:phase5a` | VERIFIED LOCALLY |
| P5B-008 | All approved Phase 5A payroll sources calculated or blocked | source adapter coverage | Unit | `npm run test:phase5a` | VERIFIED LOCALLY |
| P5B-009 | Payroll arithmetic and persisted batch totals use Decimal.js | Decimal accumulation in persist | Unit | `npm run test:phase5a` | IMPLEMENTED BUT NOT VERIFIED |
| P5B-010 | Destructive seeds rejected in production with guard | NODE_ENV check | Config | `npm run test:phase5a` | IMPLEMENTED BUT NOT VERIFIED |

## Step 1: Data Model

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-011 | PayrollOutputPackage model created with all fields | output package schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-012 | PayslipSnapshot model created with all fields | payslip schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-013 | PayrollPaymentBatch model created with lifecycle | payment batch schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-014 | PayrollPaymentInstruction model created | payment instruction schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-015 | PayrollExportRecord model created | export record schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-016 | PayrollStatutoryReport model created | statutory report schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-017 | PayrollJournalBatch and PayrollJournalLine models created | journal schema | Migration | `npm run prisma:migrate` | PENDING |
| P5B-018 | Unique constraint on one active output per batch | uniqueness enforced | Migration | `npm run prisma:migrate` | PENDING |
| P5B-019 | All monetary values use Prisma Decimal | Decimal types | Migration | `npm run prisma:migrate` | PENDING |

## Step 2: Payroll Finalization

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-020 | Approved batch finalizes into immutable output package | approved batch finalizes | Unit | `npm run test:phase5b` | PENDING |
| P5B-021 | Unapproved batch blocks finalization | unapproved batch blocks | Unit | `npm run test:phase5b` | PENDING |
| P5B-022 | Reconciliation failure blocks finalization | reconciliation failure blocks | Unit | `npm run test:phase5b` | PENDING |
| P5B-023 | Repeated finalization is idempotent | idempotent finalization | Unit | `npm run test:phase5b` | PENDING |
| P5B-024 | Snapshot unchanged after employee updates | historical immutability | Unit | `npm run test:phase5b` | PENDING |
| P5B-025 | SHA-256 hash generated for output package | snapshot hash | Unit | `npm run test:phase5b` | PENDING |
| P5B-026 | Maker-checker: finalizer cannot approve own output | maker-checker separation | Unit | `npm run test:phase5b` | PENDING |
| P5B-027 | Cancellation requires permission and reason | cancel output | Unit | `npm run test:phase5b` | PENDING |

## Step 3: Payslips

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-028 | One payslip per payroll row | payslip per row | Unit | `npm run test:phase5b` | PENDING |
| P5B-029 | Exact line totals match approved calculation | line total verification | Unit | `npm run test:phase5b` | PENDING |
| P5B-030 | Historical payslip unchanged after employee update | historical immutability | Unit | `npm run test:phase5b` | PENDING |
| P5B-031 | Account numbers masked in payslip | account masking | Unit | `npm run test:phase5b` | PENDING |
| P5B-032 | Employee can view only own published payslip | own-payslip access | Unit | `npm run test:phase5b` | PENDING |
| P5B-033 | Unauthorized access returns 403 | unauthorized access | Unit | `npm run test:phase5b` | PENDING |
| P5B-034 | Download action is audited | download audit | Unit | `npm run test:phase5b` | PENDING |
| P5B-035 | PDF generation from snapshot | PDF generation | Unit | `npm run test:phase5b` | PENDING |
| P5B-036 | Repeated generation is idempotent | idempotent payslips | Unit | `npm run test:phase5b` | PENDING |

## Step 4: Payment Readiness

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-037 | Payment readiness evaluates all employees | readiness evaluation | Unit | `npm run test:phase5b` | PENDING |
| P5B-038 | BANK requires valid bank profile | bank readiness blockers | Unit | `npm run test:phase5b` | PENDING |
| P5B-039 | MPESA requires valid mobile account | mpesa readiness blockers | Unit | `npm run test:phase5b` | PENDING |
| P5B-040 | MANUAL requires approved reason | manual readiness | Unit | `npm run test:phase5b` | PENDING |
| P5B-041 | HOLD excludes from payment export | hold exclusion | Unit | `npm run test:phase5b` | PENDING |
| P5B-042 | Duplicate payment instruction detected | duplicate prevention | Unit | `npm run test:phase5b` | PENDING |

## Step 5: Payment Batches

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-043 | Bank payment batch from approved output | bank batch creation | Unit | `npm run test:phase5b` | PENDING |
| P5B-044 | M-PESA payment batch from approved output | mpesa batch creation | Unit | `npm run test:phase5b` | PENDING |
| P5B-045 | Maker-checker for payment batches | maker-checker payments | Unit | `npm run test:phase5b` | PENDING |
| P5B-046 | Payment amount equals approved net salary | amount verification | Unit | `npm run test:phase5b` | PENDING |
| P5B-047 | Batch total reconciles to output net-pay total | batch reconciliation | Unit | `npm run test:phase5b` | PENDING |
| P5B-048 | Duplicate generation prevented | idempotent batches | Unit | `npm run test:phase5b` | PENDING |
| P5B-049 | Cancellation with reason | batch cancellation | Unit | `npm run test:phase5b` | PENDING |
| P5B-050 | Retry from failed instruction | payment retry | Unit | `npm run test:phase5b` | PENDING |
| P5B-051 | Double-payment prevention | double payment blocked | Unit | `npm run test:phase5b` | PENDING |

## Step 6: Payment Exports

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-052 | Generic bank CSV export | bank CSV export | Unit | `npm run test:phase5b` | PENDING |
| P5B-053 | Generic M-PESA CSV export | mpesa CSV export | Unit | `npm run test:phase5b` | PENDING |
| P5B-054 | XLSX payment register | XLSX register | Unit | `npm run test:phase5b` | PENDING |
| P5B-055 | Checksum stability across regenerations | checksum stability | Unit | `npm run test:phase5b` | PENDING |
| P5B-056 | Row count and amount total verification | export totals | Unit | `npm run test:phase5b` | PENDING |
| P5B-057 | Masked account values in UI preview | masked UI preview | Unit | `npm run test:phase5b` | PENDING |
| P5B-058 | Download action audited | audited download | Unit | `npm run test:phase5b` | PENDING |
| P5B-059 | Configurable export templates | export templates | Unit | `npm run test:phase5b` | PENDING |

## Step 7: Payment Reconciliation

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-060 | Mark instruction PAID with transaction reference | mark paid | Unit | `npm run test:phase5b` | PENDING |
| P5B-061 | Mark instruction FAILED with reason | mark failed | Unit | `npm run test:phase5b` | PENDING |
| P5B-062 | Hold instruction with reason | instruction hold | Unit | `npm run test:phase5b` | PENDING |
| P5B-063 | Duplicate external reference rejected | duplicate reference | Unit | `npm run test:phase5b` | PENDING |
| P5B-064 | Paid instructions immutable | paid immutability | Unit | `npm run test:phase5b` | PENDING |
| P5B-065 | Reconciliation totals reported | reconciliation totals | Unit | `npm run test:phase5b` | PENDING |

## Step 8: Statutory Reports

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-066 | PAYE report from approved output | PAYE report generation | Unit | `npm run test:phase5b` | PENDING |
| P5B-067 | Pension report from approved output | pension report generation | Unit | `npm run test:phase5b` | PENDING |
| P5B-068 | PAYE total equals approved batch total | PAYE total verification | Unit | `npm run test:phase5b` | PENDING |
| P5B-069 | Pension totals equal approved batch totals | pension total verification | Unit | `npm run test:phase5b` | PENDING |
| P5B-070 | Report review and approval workflow | report approval | Unit | `npm run test:phase5b` | PENDING |
| P5B-071 | Filing reference recorded | filing reference | Unit | `npm run test:phase5b` | PENDING |
| P5B-072 | Missing tax/pension ID handling | missing ID handling | Unit | `npm run test:phase5b` | PENDING |
| P5B-073 | Approved report is immutable | immutable report | Unit | `npm run test:phase5b` | PENDING |

## Step 9: Payroll Register and Journal

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-074 | Payroll register CSV/XLSX export | register export | Unit | `npm run test:phase5b` | PENDING |
| P5B-075 | Journal debit equals credit | balanced journal | Unit | `npm run test:phase5b` | PENDING |
| P5B-076 | Missing GL mapping blocks journal | missing mapping blocks | Unit | `npm run test:phase5b` | PENDING |
| P5B-077 | Component mapping to GL accounts | component mapping | Unit | `npm run test:phase5b` | PENDING |
| P5B-078 | Cost-center grouping in journal lines | cost center grouping | Unit | `npm run test:phase5b` | PENDING |
| P5B-079 | Approved journal is immutable | immutable journal | Unit | `npm run test:phase5b` | PENDING |

## Step 11: RBAC

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-080 | Permission matrix enforced | permission matrix | Unit | `npm run test:phase5b` | PENDING |
| P5B-081 | Scope enforcement for payslip access | scope enforcement | Unit | `npm run test:phase5b` | PENDING |
| P5B-082 | Salary confidentiality maintained | salary confidentiality | Unit | `npm run test:phase5b` | PENDING |
| P5B-083 | Maker-checker separation for all approvals | maker-checker | Unit | `npm run test:phase5b` | PENDING |
| P5B-084 | Comprehensive audit coverage | audit coverage | Unit | `npm run test:phase5b` | PENDING |

## Step 12: Regression

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-085 | Phase 4C.2 tests still pass | phase4c2 regression | Unit | `npm run test:phase4c2` | PENDING |
| P5B-086 | Phase 5A tests still pass | phase5a regression | Unit | `npm run test:phase5a` | PENDING |
| P5B-087 | Approved Phase 5A batches unchanged | batch immutability | Unit | `npm run test:phase5b` | PENDING |
| P5B-088 | No Phase 5B action recalculates salary | no recalculation | Unit | `npm run test:phase5b` | PENDING |

## Step 13: CI

| ID | Requirement | Test Name | Test Type | CI Command | Status |
|----|-------------|-----------|-----------|------------|--------|
| P5B-089 | Complete CI pipeline passes | CI pipeline | CI | `npm run verify:phase5b` | PENDING |
| P5B-090 | Migration runs without error on fresh DB | migration | CI | `npx prisma migrate deploy` | PENDING |
| P5B-091 | Playwright tests pass in headless mode | playwright | CI | `npm run test:ui-e2e` | PENDING |
