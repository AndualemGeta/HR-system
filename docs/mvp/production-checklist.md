# Production Readiness Checklist

## Environment

- [ ] DATABASE_URL configured to PostgreSQL
- [ ] AUTH_SECRET set (32+ random bytes, hex-encoded)
- [ ] NODE_ENV=production
- [ ] NEXT_PUBLIC_APP_URL set
- [ ] HTTPS configured (reverse proxy or termination)

## Database

- [ ] Prisma migrate deploy (not db push)
- [ ] Migrations tested against fresh database
- [ ] Migrations tested against existing database with data
- [ ] No destructive seed in production
- [ ] Backup procedure documented
- [ ] Restore procedure tested

## Authentication

- [ ] AUTH_SECRET rotated from default
- [ ] HTTP-only cookies enforced
- [ ] Session timeout configured
- [ ] Failed login lockout enabled
- [ ] Password change required on first login

## Build & Deploy

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] TypeScript strict mode enabled
- [ ] No exposed secrets in build artifacts
- [ ] Source maps disabled in production (or controlled)

## Testing

- [ ] Unit tests pass (npm run test:mvp)
- [ ] E2E tests pass (npm run test:mvp-e2e)
- [ ] UI E2E tests pass (npm run test:ui-e2e)
- [ ] Migration safety verified
- [ ] Locked payroll immutability verified

## Monitoring

- [ ] Application error logging configured
- [ ] Audit log working
- [ ] Failed login monitoring
- [ ] Export tracking working

## Operations

- [ ] Month-end procedure documented (docs/mvp/payroll-month-end-guide.md)
- [ ] User guide documented (docs/mvp/user-guide.md)
- [ ] Backup and restore documented (docs/mvp/backup-and-restore.md)
- [ ] Deployment documented (docs/mvp/deployment.md)
