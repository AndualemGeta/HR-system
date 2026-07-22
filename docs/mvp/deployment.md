# Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/leapfrog_hr
AUTH_SECRET=<32-byte-random-hex>
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Generate AUTH_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Install & Build

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

## Production Checklist

- [ ] HTTPS configured
- [ ] AUTH_SECRET set (not default)
- [ ] DATABASE_URL points to production PostgreSQL
- [ ] Prisma migrate deploy (not db push)
- [ ] No destructive seed in production
- [ ] Application logging configured
- [ ] Backup procedure in place

## Directory Structure

```
uploads/
  payroll-exports/   # Generated Excel files
```

Ensure the uploads directory exists and is writable.

## Health Check

Access: `https://your-domain.com/login`
