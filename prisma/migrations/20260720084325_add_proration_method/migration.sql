-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'KPI_ASSIGNMENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'KPI_ASSIGNMENT_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE 'KPI_ASSIGNMENT_CLOSE';
ALTER TYPE "AuditAction" ADD VALUE 'KPI_ASSIGNMENT_DEACTIVATE';

-- AlterTable
ALTER TABLE "PayrollPeriod" ADD COLUMN     "prorationMethod" TEXT NOT NULL DEFAULT 'NONE';
