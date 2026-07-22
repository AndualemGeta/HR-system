# Phase 5B — Known Risks

## Critical

| Risk | Impact | Mitigation |
|------|--------|------------|
| Snapshot hash mismatch after Decimal precision change | Reconciliation failure | Use strict `toFixed(2)` rounding before hashing |
| Large payroll periods (>5000 employees) timeout in single transaction | Finalization or export failure | Batch processing for large periods; increase API timeout |
| Bank account numbers stored unhashed in export files | Data exposure | Mask in UI; encrypt downloaded files; audit every download |

## High

| Risk | Impact | Mitigation |
|------|--------|------------|
| Maker-checker bypass via direct API call | Unauthorized approval | Server-side enforcement; never trust client role claims |
| Duplicate payment batch generation | Double payment | Unique constraint on (outputPackageId, paymentMethod, employeeId) |
| Missing tax or pension ID blocks whole report | Delayed filing | Decision pending on exception-report approach |
| Re-seeding in production deletes output data | Data loss | Production guard in seed.ts; NODE_ENV check |

## Medium

| Risk | Impact | Mitigation |
|------|--------|------------|
| Template changes alter historical export checksums | Audit integrity violation | Versioned templates; historical exports reference template version used |
| Negative net salary employee excluded from payment batch silently | Underpayment | HOLD with explicit reason; reconcile batch total to output total |
| Browser back button shows stale payment status | Confusion | Client-side refresh; status polling |
| CI seed missing required Phase 5B users | CI failure | seed-ci.ts creates all 5 required users |

## Low

| Risk | Impact | Mitigation |
|------|--------|------------|
| Playwright test flakiness from async state transitions | CI flaky failures | Retry logic; stable selectors; isolated test data |
| Large PDF payslips consume excessive disk space | Storage cost | Single-generation; compress historical PDFs |
| Audit log volume from download events | Table growth | Archive policy; indexed by entityId and createdAt |
