# Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm 9+

## Environment Variables

```
DATABASE_URL=postgresql://user:password@host:5432/leapfrog_hr
SESSION_SECRET=<random-64-char-hex>
PAYROLL_EXPORT_DIR=/path/to/persistent/storage (optional, defaults to ./uploads/payroll-exports)
MVP_MODE=true (hides phase 5A/5B routes)
TEST_BASE_URL=http://127.0.0.1:3000
```

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
