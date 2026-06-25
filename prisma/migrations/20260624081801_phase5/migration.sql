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
	IF to_regclass('"LeavePolicy_employmentType_effectiveStartDate_effectiveEndDate_"') IS NOT NULL THEN
		ALTER INDEX "LeavePolicy_employmentType_effectiveStartDate_effectiveEndDate_" RENAME TO "LeavePolicy_employmentType_effectiveStartDate_effectiveEndD_idx";
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
	IF to_regclass('"PayrollAdjustment_employeeId_payrollPeriodStart_payrollPeriodEn"') IS NOT NULL THEN
		ALTER INDEX "PayrollAdjustment_employeeId_payrollPeriodStart_payrollPeriodEn" RENAME TO "PayrollAdjustment_employeeId_payrollPeriodStart_payrollPeri_idx";
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
