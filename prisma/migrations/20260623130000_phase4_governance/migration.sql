-- Phase 4 scale, governance, analytics, and internal integration foundations.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OVERDUE_WORKFLOW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPROVAL_ESCALATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_DIGEST';

CREATE TYPE "PayrollBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'UNDER_REVIEW', 'APPROVED', 'EXPORTED', 'CANCELLED');
CREATE TYPE "PayrollReadinessStatus" AS ENUM ('READY', 'WARNING', 'BLOCKED');
CREATE TYPE "KpiMetricType" AS ENUM ('SALES', 'ATTENDANCE', 'CUSTOMER_SERVICE', 'COMPLIANCE', 'OPERATIONAL', 'FINANCE', 'HR', 'TECHNOLOGY', 'OTHER');
CREATE TYPE "KpiRating" AS ENUM ('EXCEEDED', 'MET', 'PARTIALLY_MET', 'NOT_MET', 'NOT_APPLICABLE');
CREATE TYPE "KpiResultStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "NotificationCategory" AS ENUM ('APPROVALS', 'HR_WORKFLOWS', 'PAYROLL', 'KPI', 'DOCUMENTS', 'COMPLIANCE', 'SYSTEM');
CREATE TYPE "ProfileChangeField" AS ENUM ('PHONE_NUMBER', 'ADDRESS', 'PERSONAL_EMAIL', 'EMERGENCY_CONTACT');
CREATE TYPE "ProfileChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "DataQualityIssueType" AS ENUM ('MISSING_FIELD', 'INVALID_ROLE', 'MISSING_MANAGER', 'MISSING_ASSIGNMENT', 'MULTIPLE_ACTIVE_ASSIGNMENTS', 'MISSING_DOCUMENT', 'MISSING_SALARY', 'DUPLICATE_CANDIDATE', 'INVALID_STATUS', 'PAYROLL_BLOCKER', 'OTHER');
CREATE TYPE "DataQualitySeverity" AS ENUM ('BLOCKER', 'WARNING', 'REVIEW');
CREATE TYPE "DataQualityStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ReminderType" AS ENUM ('PROBATION_ENDING', 'EVALUATION_DUE', 'CONTRACT_EXPIRY', 'DOCUMENT_EXPIRY', 'DISCIPLINARY_FOLLOW_UP', 'EXIT_CLEARANCE', 'PAYROLL_PREPARATION', 'KPI_REVIEW', 'OTHER');
CREATE TYPE "ReminderStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED', 'OVERDUE');
CREATE TYPE "SystemSettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_BATCH_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_BATCH_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_VALIDATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ROW_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_BATCH_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_BATCH_EXPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_FILE_DOWNLOAD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_DATA_ACCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KPI_METRIC_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KPI_RESULT_IMPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KPI_RESULT_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KPI_RESULT_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ANALYTICS_VIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMPLIANCE_VIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'NOTIFICATION_PREFERENCE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFILE_CHANGE_REQUEST_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFILE_CHANGE_REQUEST_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFILE_CHANGE_REQUEST_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFILE_CHANGE_REQUEST_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVAL_GOVERNANCE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_QUALITY_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_QUALITY_ASSIGN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_QUALITY_RESOLVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_QUALITY_DISMISS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REMINDER_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REMINDER_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REMINDER_COMPLETE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REMINDER_CANCEL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYSTEM_SETTING_UPDATE';

ALTER TABLE "ApprovalStep"
  ADD COLUMN "fallbackApproverRole" "SystemRole",
  ADD COLUMN "fallbackApproverUserId" TEXT,
  ADD COLUMN "escalationRole" "SystemRole",
  ADD COLUMN "escalationAfterDays" INTEGER,
  ADD COLUMN "preventSelfApproval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireCommentsOnReject" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireCommentsOnChange" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPreparationBatch" (
  "id" TEXT NOT NULL,
  "batchName" TEXT NOT NULL,
  "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
  "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "status" "PayrollBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "totalEmployees" INTEGER NOT NULL DEFAULT 0,
  "readyCount" INTEGER NOT NULL DEFAULT 0,
  "blockedCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPreparationBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPreparationRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "employmentType" TEXT,
  "division" TEXT,
  "department" TEXT,
  "region" TEXT,
  "shop" TEXT,
  "cluster" TEXT,
  "role" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "basicSalary" DECIMAL(12,2),
  "salaryEffectiveDate" TIMESTAMP(3),
  "employmentStatus" TEXT NOT NULL,
  "readinessStatus" "PayrollReadinessStatus" NOT NULL,
  "validationIssues" JSONB,
  "includedInExport" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPreparationRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiMetric" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "metricType" "KpiMetricType" NOT NULL,
  "applicableRole" "EmployeeRole",
  "applicableDepartmentId" TEXT,
  "applicableDivisionId" TEXT,
  "unit" TEXT,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeKpiResult" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "metricId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "targetValue" DECIMAL(12,2),
  "actualValue" DECIMAL(12,2) NOT NULL,
  "achievementPercent" DECIMAL(8,2),
  "rating" "KpiRating" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "source" TEXT,
  "uploadedById" TEXT,
  "approvedById" TEXT,
  "approvalStatus" "KpiResultStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeKpiResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeProfileChangeRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestedField" "ProfileChangeField" NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT NOT NULL,
  "reason" TEXT,
  "status" "ProfileChangeRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataQualityIssue" (
  "id" TEXT NOT NULL,
  "issueType" "DataQualityIssueType" NOT NULL,
  "severity" "DataQualitySeverity" NOT NULL,
  "employeeId" TEXT,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "description" TEXT NOT NULL,
  "suggestedFix" TEXT,
  "status" "DataQualityStatus" NOT NULL DEFAULT 'OPEN',
  "detectedById" TEXT,
  "assignedToId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HRReminder" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "reminderType" "ReminderType" NOT NULL,
  "relatedEmployeeId" TEXT,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "assignedToId" TEXT,
  "status" "ReminderStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HRReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "valueType" "SystemSettingValueType" NOT NULL DEFAULT 'STRING',
  "description" TEXT,
  "isSensitive" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExportHistory" (
  "id" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "fileName" TEXT,
  "createdById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");
CREATE INDEX "NotificationPreference_category_idx" ON "NotificationPreference"("category");
CREATE INDEX "PayrollPreparationBatch_status_idx" ON "PayrollPreparationBatch"("status");
CREATE INDEX "PayrollPreparationBatch_payrollPeriodStart_payrollPeriodEnd_idx" ON "PayrollPreparationBatch"("payrollPeriodStart", "payrollPeriodEnd");
CREATE UNIQUE INDEX "PayrollPreparationRow_batchId_employeeId_key" ON "PayrollPreparationRow"("batchId", "employeeId");
CREATE INDEX "PayrollPreparationRow_readinessStatus_idx" ON "PayrollPreparationRow"("readinessStatus");
CREATE UNIQUE INDEX "KpiMetric_name_key" ON "KpiMetric"("name");
CREATE INDEX "KpiMetric_metricType_activeStatus_idx" ON "KpiMetric"("metricType", "activeStatus");
CREATE INDEX "EmployeeKpiResult_employeeId_periodStart_periodEnd_idx" ON "EmployeeKpiResult"("employeeId", "periodStart", "periodEnd");
CREATE INDEX "EmployeeKpiResult_metricId_idx" ON "EmployeeKpiResult"("metricId");
CREATE INDEX "EmployeeKpiResult_approvalStatus_idx" ON "EmployeeKpiResult"("approvalStatus");
CREATE INDEX "EmployeeProfileChangeRequest_employeeId_status_idx" ON "EmployeeProfileChangeRequest"("employeeId", "status");
CREATE INDEX "DataQualityIssue_issueType_severity_idx" ON "DataQualityIssue"("issueType", "severity");
CREATE INDEX "DataQualityIssue_status_idx" ON "DataQualityIssue"("status");
CREATE INDEX "DataQualityIssue_employeeId_idx" ON "DataQualityIssue"("employeeId");
CREATE INDEX "HRReminder_dueDate_status_idx" ON "HRReminder"("dueDate", "status");
CREATE INDEX "HRReminder_relatedEmployeeId_idx" ON "HRReminder"("relatedEmployeeId");
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX "ExportHistory_exportType_idx" ON "ExportHistory"("exportType");
CREATE INDEX "ExportHistory_createdAt_idx" ON "ExportHistory"("createdAt");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPreparationRow" ADD CONSTRAINT "PayrollPreparationRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollPreparationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPreparationRow" ADD CONSTRAINT "PayrollPreparationRow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeKpiResult" ADD CONSTRAINT "EmployeeKpiResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeKpiResult" ADD CONSTRAINT "EmployeeKpiResult_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "KpiMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfileChangeRequest" ADD CONSTRAINT "EmployeeProfileChangeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HRReminder" ADD CONSTRAINT "HRReminder_relatedEmployeeId_fkey" FOREIGN KEY ("relatedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
