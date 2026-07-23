# Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm 9+

## Environment Variables

```
DATABASE_URL=postgresql://user:password@host:5432/leapfrog_hr
AUTH_SECRET=<random-64-char-hex>
MVP_MODE=true                                            # Required for production-review deployment
PAYROLL_EXPORT_DIR=/path/to/persistent/storage           # Must use persistent storage
TEST_BASE_URL=http://127.0.0.1:3000
```

### Important Notes on Environment Variables

- **AUTH_SECRET**: Replaces the old `SESSION_SECRET`. Generate with `openssl rand -hex 32`.
- **MVP_MODE**: Must be `true` for the production-review deployment. This hides Phase 5A/5B routes and blocks non-MVP APIs.
- **PAYROLL_EXPORT_DIR**: Must point to persistent storage (mounted volume in production). The company payroll template is mandatory — there is no generic export fallback. If the template is missing or corrupt, exports will fail with a clear error.
- **Company Payroll Template**: The file `templates/payroll/Salary_June_2026_reference.xlsx` is mandatory. It contains 11 payroll-group sheets with pre-defined headers, styles, and layout. Export generation requires this file and will fail with an explicit error if it is missing, unreadable, or missing required worksheets.

## Installation

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed:ci    # creates admin user and basic data
npm run build
npm start
```

## PAYROLL_EXPORT_DIR

This directory stores generated payroll Excel files. It requires persistent storage:

- **Production**: Set to a mounted volume or cloud storage path (e.g., `/data/payroll-exports`)
- **Development**: Defaults to `./uploads/payroll-exports`

The application validates at startup that the directory exists or can be created.

## Migration

```bash
npx prisma migrate deploy    # apply pending migrations
npm run prisma:generate      # regenerate Prisma client
```

## Rollback

```bash
npx prisma migrate resolve --rolled-back <migration-name>
```

## Health Check

```
GET /api/auth/me → 200 if server is running and healthy
```

## CI/CD

The `verify:mvp:ci` command runs the full validation pipeline:

```bash
npm run verify:mvp:ci
```

This performs: install → generate → migrate → seed → typecheck → lint → build → unit tests → E2E tests → Playwright tests.
