# Statutory Configuration Guide

## PAYE Brackets

### Overview

PAYE tax brackets define the progressive tax rate structure. Brackets are grouped into **schedules** using a `scheduleCode`.

### Creating Brackets

Each bracket requires:
- `name`: Human-readable label
- `minIncome`: Lower bound (inclusive)
- `maxIncome`: Upper bound (exclusive, null for highest bracket)
- `taxRate`: Percentage rate (0–100)
- `deductionAmount`: Fixed deduction amount (≥ 0)
- `effectiveStartDate` / `effectiveEndDate`: Validity period
- `scheduleCode`: Groups brackets into one complete schedule

### Validation Rules

Before a schedule can be approved:
1. All brackets must have valid values (min ≥ 0, max > min, rate 0–100, deduction ≥ 0)
2. Exactly one open-ended bracket (maxIncome = null) — must be the highest
3. No gaps between consecutive brackets
4. No overlaps between consecutive brackets
5. Boundary consistency: each bracket's maxIncome must match the next bracket's minIncome

### Approval

Approving any bracket in a schedule validates the **entire schedule**. If valid, ALL brackets in that schedule are approved as a set. Partial schedules cannot be approved.

### Boundary Convention

```
minIncome: inclusive (income ≥ minIncome matches this bracket)
maxIncome: exclusive (income < maxIncome matches this bracket)
```

Example: `[0, 600), [600, 1650), [1650, 3200), ... [15000, null)`

Income of 600 matches the second bracket, not the first.

## Pension Rules

### Overview

Pension rules define contribution rates and base calculation. Rules can be general or specific to a role/employment type.

### Fields

| Field | Description |
|-------|-------------|
| `employeeRate` | Employee contribution % |
| `employerRate` | Employer contribution % |
| `pensionBaseType` | `BASIC_SALARY` or `PENSIONABLE_EARNINGS` |
| `minimumBase` | Floor for pensionable base (null = no floor) |
| `maximumBase` | Cap for pensionable base (null = no cap) |
| `priority` | Higher priority wins when scores are tied |
| `applicableRole` | Restrict to this role (null = all roles) |
| `applicableEmploymentType` | Restrict to this employment type (null = all types) |

### Selection Logic

1. Score each rule: role match (+10), employment type match (+5)
2. Within tied scores, highest priority wins
3. Equal priority + same score = BLOCKED
4. No matching rule = BLOCKED

### Examples

```
Rule A: employeeRate=7%, employerRate=11%, base=BASIC_SALARY, priority=0  (general)
Rule B: employeeRate=8%, employerRate=12%, base=BASIC_SALARY, priority=10, role=DSA

DSA employee → Rule B (role-specific, higher priority)
Non-DSA employee → Rule A (general rule applies)
```

## Configuration Workflow

1. **Create** draft brackets/rules via API or seed
2. **Review** values for correctness
3. **Validate** the complete schedule (PAYE only)
4. **Approve** — activates the entire schedule (PAYE) or individual rule (pension)
5. **Deactivate** to expire a schedule/rule without deleting it

## Sample Data

Seed data includes sample PAYE brackets and pension rules. These have:
- `isSample = true`
- `isActive = false`
- `approvalStatus = 'DRAFT'`

Sample data must be independently verified by Finance before approval.
