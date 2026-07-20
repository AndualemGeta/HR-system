-- CreateEnum
CREATE TYPE "PayrollProrationMethod" AS ENUM ('NONE', 'CALENDAR_DAYS', 'WORKING_DAYS', 'MANUAL');

-- AlterTable
ALTER TABLE "PayrollPeriod" 
  ALTER COLUMN "prorationMethod" DROP DEFAULT,
  ALTER COLUMN "prorationMethod" TYPE "PayrollProrationMethod" 
    USING ("prorationMethod"::text)::"PayrollProrationMethod";
ALTER TABLE "PayrollPeriod" 
  ALTER COLUMN "prorationMethod" SET DEFAULT 'NONE';
