-- Pre-Phase 5 HRIS hardening: payroll rule governance and configurable required document rules.

CREATE TYPE "PayrollRuleApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DEACTIVATED');

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EMERGENCY_CONTACT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'BANK_OR_PAYMENT_INFORMATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'TAX_OR_PAYROLL_INFORMATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'COMMISSION_AGREEMENT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CONTRACT_OR_SERVICE_AGREEMENT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'COMMISSION_PLAN_ACKNOWLEDGEMENT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_LETTER';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'RESPONSIBILITY_DOCUMENT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CONFIDENTIALITY_DOCUMENT';

ALTER TABLE "PayrollRule"
  ADD COLUMN "approvalStatus" "PayrollRuleApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "changeReason" TEXT,
  ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PayeTaxBracket"
  ADD COLUMN "approvalStatus" "PayrollRuleApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "changeReason" TEXT,
  ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PensionRule"
  ADD COLUMN "approvalStatus" "PayrollRuleApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "changeReason" TEXT,
  ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CommissionPlan"
  ADD COLUMN "approvalStatus" "PayrollRuleApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "changeReason" TEXT,
  ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RequiredDocumentRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "applicableEmploymentType" "EmploymentType",
  "applicableRole" "EmployeeRole",
  "applicableDepartmentId" TEXT,
  "applicableDivisionId" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequiredDocumentRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollRule_ruleType_activeStatus_approvalStatus_idx" ON "PayrollRule"("ruleType", "activeStatus", "approvalStatus");
CREATE INDEX "PayeTaxBracket_activeStatus_approvalStatus_effectiveStartDate_effectiveEndDate_idx" ON "PayeTaxBracket"("activeStatus", "approvalStatus", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "PensionRule_activeStatus_approvalStatus_effectiveStartDate_effectiveEndDate_idx" ON "PensionRule"("activeStatus", "approvalStatus", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "CommissionPlan_activeStatus_approvalStatus_effectiveStartDate_effectiveEndDate_idx" ON "CommissionPlan"("activeStatus", "approvalStatus", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "RequiredDocumentRule_activeStatus_documentType_idx" ON "RequiredDocumentRule"("activeStatus", "documentType");
CREATE INDEX "RequiredDocumentRule_applicableEmploymentType_applicableRole_idx" ON "RequiredDocumentRule"("applicableEmploymentType", "applicableRole");
CREATE INDEX "RequiredDocumentRule_applicableDepartmentId_applicableDivisionId_idx" ON "RequiredDocumentRule"("applicableDepartmentId", "applicableDivisionId");

ALTER TABLE "RequiredDocumentRule"
  ADD CONSTRAINT "RequiredDocumentRule_applicableDepartmentId_fkey"
  FOREIGN KEY ("applicableDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RequiredDocumentRule"
  ADD CONSTRAINT "RequiredDocumentRule_applicableDivisionId_fkey"
  FOREIGN KEY ("applicableDivisionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
