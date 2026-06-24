-- DropIndex
DROP INDEX IF EXISTS "CommissionPlan_activeStatus_effectiveStartDate_effectiveEnd_idx";

-- DropIndex
DROP INDEX IF EXISTS "PayeTaxBracket_activeStatus_effectiveStartDate_effectiveEnd_idx";

-- DropIndex
DROP INDEX IF EXISTS "PayrollRule_ruleType_activeStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "PensionRule_activeStatus_effectiveStartDate_effectiveEndDat_idx";

-- AlterTable
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

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"CommissionPlan_activeStatus_approvalStatus_effectiveStartDate_e"') IS NOT NULL THEN
    ALTER INDEX "CommissionPlan_activeStatus_approvalStatus_effectiveStartDate_e" RENAME TO "CommissionPlan_activeStatus_approvalStatus_effectiveStartDa_idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"PayeTaxBracket_activeStatus_approvalStatus_effectiveStartDate_e"') IS NOT NULL THEN
    ALTER INDEX "PayeTaxBracket_activeStatus_approvalStatus_effectiveStartDate_e" RENAME TO "PayeTaxBracket_activeStatus_approvalStatus_effectiveStartDa_idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"PensionRule_activeStatus_approvalStatus_effectiveStartDate_effe"') IS NOT NULL THEN
    ALTER INDEX "PensionRule_activeStatus_approvalStatus_effectiveStartDate_effe" RENAME TO "PensionRule_activeStatus_approvalStatus_effectiveStartDate__idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"RequiredDocumentRule_applicableDepartmentId_applicableDivisionI"') IS NOT NULL THEN
    ALTER INDEX "RequiredDocumentRule_applicableDepartmentId_applicableDivisionI" RENAME TO "RequiredDocumentRule_applicableDepartmentId_applicableDivis_idx";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF to_regclass('"RequiredDocumentRule_applicableEmploymentType_applicableRole_id"') IS NOT NULL THEN
    ALTER INDEX "RequiredDocumentRule_applicableEmploymentType_applicableRole_id" RENAME TO "RequiredDocumentRule_applicableEmploymentType_applicableRol_idx";
  END IF;
END $$;
