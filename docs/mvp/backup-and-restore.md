# Backup and Restore

## Database Backup

```bash
pg_dump -h localhost -U postgres -d leapfrog_hr > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Database Restore

```bash
psql -h localhost -U postgres -d leapfrog_hr < backup_file.sql
```

## File Backups

Payroll exports are stored in `uploads/payroll-exports/`. Back up this directory:

```bash
tar -czf payroll-exports-backup.tar.gz uploads/payroll-exports/
```

## Migration Safety

- Always run `npx prisma migrate deploy` (not db push) in production
- Test migrations against a copy of the production database first
- Keep migration history in version control

## Verification After Restore

1. Check employee count matches expected
2. Check payroll periods exist
3. Verify a locked period is still locked
4. Generate a test export
