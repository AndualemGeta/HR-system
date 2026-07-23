# Backup and Restore

## Database

### Backup
```bash
pg_dump -h localhost -p 5433 -U postgres -d leapfrog_hr -F c -f backup_$(date +%Y%m%d).dump
```

### Restore
```bash
pg_restore -h localhost -p 5433 -U postgres -d leapfrog_hr -c backup_20260723.dump
```

## Payroll Export Files

The `PAYROLL_EXPORT_DIR` directory contains all generated payroll Excel files. Include this directory in your backup strategy:

```bash
tar -czf payroll-exports-$(date +%Y%m%d).tar.gz /path/to/payroll-exports/
```

## Recommended Backup Schedule

- **Database**: Daily automated backup
- **Export files**: Weekly backup (files are immutable once created)
- **Retention**: 90 days for daily, 12 months for monthly archives

## Disaster Recovery

1. Restore database from latest backup
2. Restore export directory from latest backup
3. Verify data integrity by checking the latest payroll period status
4. Run `npm run prisma:generate` if Prisma client is out of sync
