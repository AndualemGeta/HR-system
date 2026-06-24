-- AlterTable
-- This migration can replay before the lifecycle migration that adds
-- DisciplinaryRecord.updatedAt, so guard the cleanup for shadow databases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'DisciplinaryRecord'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "DisciplinaryRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
