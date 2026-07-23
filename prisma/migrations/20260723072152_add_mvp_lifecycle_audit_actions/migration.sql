-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PAYROLL_PERIOD_READY';
ALTER TYPE "AuditAction" ADD VALUE 'PAYROLL_PERIOD_REOPEN';
ALTER TYPE "AuditAction" ADD VALUE 'PAYROLL_ROW_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'PAYROLL_EXPORT_DOWNLOAD';
