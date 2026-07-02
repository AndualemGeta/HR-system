# Phase 4C.1 — Shop Master and Shop Status Setup Review Checklist

## Scope
Phase 4C.1 creates Shop Master and Shop Status setup only.
It does not calculate Shop Manager incentives.
It does not calculate payroll.
It does not calculate tax.
It does not calculate pension.
It does not generate payslips.
It does not export bank or M-PESA payments.
Phase 4C.2 will handle Shop Manager Incentive calculation after approval.

## API Endpoints

### Shops
- [x] GET /api/shops — List all shops (scope-filtered)
- [x] POST /api/shops — Create a new shop
- [x] GET /api/shops/:id — Get shop detail with profile, criteria, employees
- [x] PATCH /api/shops/:id — Update shop name, parent, manager, corridor, incentive
- [x] POST /api/shops/:id/deactivate — Deactivate shop
- [x] POST /api/shops/:id/reactivate — Reactivate shop
- [x] GET /api/shops/:id/criteria-status — Get criteria history
- [x] POST /api/shops/:id/criteria-status — Update shop criteria

### Supporting
- [x] GET /api/locations — Filter locations by type and parentId

## UI Pages
- [x] /shops — Shop list with filters (region, area, criteria, corridor, active, incentive)
- [x] /shops/new — Create shop form
- [x] /shops/:id — Shop detail with profile, manager, criteria history, assigned employees
- [x] /shops/:id/edit — Edit shop form
- [x] /shops/:id/criteria — Update criteria form

## Models (Prisma)
- [x] CorridorType enum (CORRIDOR, NON_CORRIDOR, UNKNOWN)
- [x] ShopCriteria enum (GOLD, SILVER, BRONZE, AT_RISK, UNASSIGNED)
- [x] ShopProfile model (shopLocationId, corridorType, defaultShopManagerId, isIncentiveEligible)
- [x] ShopCriteriaStatusHistory model (criteria, effectiveFrom/To, reason)

## Audit Actions
- [x] SHOP_CREATE, SHOP_UPDATE, SHOP_DEACTIVATE, SHOP_REACTIVATE
- [x] SHOP_MANAGER_ASSIGN, SHOP_CRITERIA_UPDATE, SHOP_PROFILE_UPDATE

## Permissions (8 new)
- [x] shop.view, shop.create, shop.update, shop.deactivate, shop.reactivate
- [x] shop.assignManager, shop.updateCriteria, shop.viewCriteriaHistory

## Scope Rules
- [x] SUPER_ADMIN, HR_ADMIN, FINANCE_DIRECTOR, FINANCE_PAYROLL, AUDITOR: all shops
- [x] SALES_HEAD: all shops (type filter)
- [x] ASM: shops in assigned area
- [x] SHOP_MANAGER: own shop only
- [x] EMPLOYEE: no access

## Test Results
- [x] 85 Phase 4C.1 tests pass
- [x] All previous phase tests unaffected

## Quality Gates
- [x] prisma generate
- [x] npm test (Phase 4C.1: 85 passing)
- [x] typecheck (0 errors)
- [x] lint (0 new errors, 5 pre-existing warnings)
- [x] build (65 static pages, 0 errors)

## Stabilization Fixes Applied
- [x] POST /api/shops hierarchy: regionId required, areaId optional (must belong to region), clusterId optional (requires areaId, must belong to area); deepest-parent logic
- [x] PATCH /api/shops/:id hierarchy: same validation rules, only changes hierarchy when at least one field present
- [x] GET /api/locations: requires `organization.view` or `shop.view`; EMPLOYEE gets forbidden; SHOP type applies scope
- [x] PATCH /api/shops/:id with `shopManagerId` also requires `shop.assignManager` permission
- [x] POST /api/shops/:id/criteria-status: `approvedById` removed from user input; uses `session.userId` as `updatedById`; `approvedById` set to null
- [x] POST deactivate already-inactive: returns `badRequest('Shop is already inactive')`
- [x] POST reactivate already-active: returns `badRequest('Shop is already active')`
- [x] UI pages: send full hierarchy path (regionId + areaId + clusterId)
- [x] Tests: 85 tests covering hierarchy validation, location access control, manager assignment enforcement, criteria update validation, deactivate/reactivate error semantics, permissions, scope, regression
- [x] Pre-existing build error resolved: removed server-only `requirePagePermission` imports from 2 client components
