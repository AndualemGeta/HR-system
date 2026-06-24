-- Phase 5 integration, automation, attendance, self-service, and production readiness foundation.

CREATE TYPE "PayrollExportFormat" AS ENUM ('CSV', 'XLSX', 'JSON');
CREATE TYPE "PayrollExportTargetSystem" AS ENUM ('INTERNAL_FINANCE', 'BANK_TEMPLATE', 'ACCOUNTING_SYSTEM', 'PAYROLL_SYSTEM', 'CUSTOM');
CREATE TYPE "PayrollExportRunStatus" AS ENUM ('CREATED', 'DOWNLOADED', 'CANCELLED', 'FAILED');
CREATE TYPE "PayrollLockStatus" AS ENUM ('UNLOCKED', 'LOCKED', 'UNLOCK_REQUESTED', 'TEMPORARILY_UNLOCKED');
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('SALARY_CORRECTION', 'ATTENDANCE_CORRECTION', 'COMMISSION_CORRECTION', 'ALLOWANCE_CORRECTION', 'DEDUCTION_CORRECTION', 'TAX_CORRECTION', 'PENSION_CORRECTION', 'OTHER');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_REST', 'SUSPENDED', 'NOT_SCHEDULED');
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'SYSTEM', 'FUTURE_INTEGRATION');
CREATE TYPE "LeaveAccrualMethod" AS ENUM ('ANNUAL_FRONTLOADED', 'MONTHLY_ACCRUAL', 'MANUAL', 'NONE');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "DataRetentionEntityType" AS ENUM ('EMPLOYEE_DOCUMENT', 'AUDIT_LOG', 'PAYROLL_EXPORT', 'TERMINATED_EMPLOYEE_RECORD', 'NOTIFICATION', 'EMAIL_LOG', 'IMPORT_FILE', 'OTHER');
CREATE TYPE "RetentionAction" AS ENUM ('ARCHIVE', 'DELETE_IF_ALLOWED', 'REVIEW_REQUIRED', 'KEEP_FOREVER');
CREATE TYPE "IntegrationEventStatus" AS ENUM ('CREATED', 'PROCESSED', 'FAILED', 'SKIPPED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_EXPORT_TEMPLATE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_EXPORT_TEMPLATE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_EXPORT_TEMPLATE_DEACTIVATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_EXPORT_RUN_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_EXPORT_RUN_DOWNLOAD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_PERIOD_LOCK';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_PERIOD_UNLOCK_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_PERIOD_UNLOCK';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ADJUSTMENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ADJUSTMENT_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_IMPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ATTENDANCE_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAVE_POLICY_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAVE_BALANCE_ADJUSTMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KPI_IMPORT_TEMPLATE_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KPI_EVALUATION_WEIGHT_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_TEMPLATE_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_DELIVERY_ATTEMPT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SECURITY_SETTING_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FAILED_LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_RETENTION_POLICY_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RETENTION_REVIEW_ACTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_TOKEN_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_TOKEN_REVOKE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_TOKEN_USE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_EVENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_EVENT_PROCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYSTEM_HEALTH_VIEW';

ALTER TABLE "User"
  ADD COLUMN "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE TABLE "PayrollExportTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "exportFormat" "PayrollExportFormat" NOT NULL,
  "targetSystem" "PayrollExportTargetSystem" NOT NULL,
  "fieldMapping" JSONB NOT NULL,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollExportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollExportRun" (
  "id" TEXT NOT NULL,
  "payrollBatchId" TEXT NOT NULL,
  "templateId" TEXT,
  "exportFormat" "PayrollExportFormat" NOT NULL,
  "exportedById" TEXT,
  "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "fileName" TEXT,
  "status" "PayrollExportRunStatus" NOT NULL DEFAULT 'CREATED',
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollExportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPeriodLock" (
  "id" TEXT NOT NULL,
  "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
  "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
  "lockedById" TEXT,
  "lockedAt" TIMESTAMP(3),
  "unlockRequestedById" TEXT,
  "unlockedById" TEXT,
  "unlockedAt" TIMESTAMP(3),
  "lockStatus" "PayrollLockStatus" NOT NULL DEFAULT 'UNLOCKED',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPeriodLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollAdjustment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
  "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
  "adjustmentType" "PayrollAdjustmentType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "appliedToBatchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "checkInTime" TIMESTAMP(3),
  "checkOutTime" TIMESTAMP(3),
  "hoursWorked" DECIMAL(8,2),
  "overtimeHours" DECIMAL(8,2),
  "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
  "recordedById" TEXT,
  "approvedById" TEXT,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeavePolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "leaveType" "LeaveType" NOT NULL,
  "employmentType" "EmploymentType",
  "annualEntitlementDays" DECIMAL(8,2) NOT NULL,
  "accrualMethod" "LeaveAccrualMethod" NOT NULL,
  "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
  "maxCarryForwardDays" DECIMAL(8,2),
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "effectiveStartDate" TIMESTAMP(3) NOT NULL,
  "effectiveEndDate" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveBalance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveType" "LeaveType" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "openingBalance" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "accruedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "usedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "adjustedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "closingBalance" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveBalanceAdjustment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveType" "LeaveType" NOT NULL,
  "adjustmentDays" DECIMAL(8,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveBalanceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiImportTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "fieldMapping" JSONB NOT NULL,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiImportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiEvaluationWeight" (
  "id" TEXT NOT NULL,
  "metricId" TEXT NOT NULL,
  "applicableRole" "EmployeeRole",
  "applicableDepartmentId" TEXT,
  "weight" DECIMAL(5,2) NOT NULL,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiEvaluationWeight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notificationType" "NotificationType" NOT NULL,
  "subjectTemplate" TEXT NOT NULL,
  "bodyTemplate" TEXT NOT NULL,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDeliveryLog" (
  "id" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "subject" TEXT NOT NULL,
  "notificationType" "NotificationType" NOT NULL,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRetentionPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "entityType" "DataRetentionEntityType" NOT NULL,
  "retentionPeriodDays" INTEGER NOT NULL,
  "actionAfterRetention" "RetentionAction" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationToken" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "allowedScopes" JSONB NOT NULL,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationEventLog" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "payloadSummary" JSONB,
  "status" "IntegrationEventStatus" NOT NULL DEFAULT 'CREATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  CONSTRAINT "IntegrationEventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionReadinessCheck" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionReadinessCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollExportTemplate_activeStatus_targetSystem_idx" ON "PayrollExportTemplate"("activeStatus", "targetSystem");
CREATE INDEX "PayrollExportRun_payrollBatchId_idx" ON "PayrollExportRun"("payrollBatchId");
CREATE INDEX "PayrollExportRun_templateId_idx" ON "PayrollExportRun"("templateId");
CREATE INDEX "PayrollExportRun_status_exportedAt_idx" ON "PayrollExportRun"("status", "exportedAt");
CREATE UNIQUE INDEX "PayrollPeriodLock_payrollPeriodStart_payrollPeriodEnd_key" ON "PayrollPeriodLock"("payrollPeriodStart", "payrollPeriodEnd");
CREATE INDEX "PayrollPeriodLock_lockStatus_idx" ON "PayrollPeriodLock"("lockStatus");
CREATE INDEX "PayrollAdjustment_employeeId_payrollPeriodStart_payrollPeriodEnd_idx" ON "PayrollAdjustment"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");
CREATE INDEX "PayrollAdjustment_approvalStatus_idx" ON "PayrollAdjustment"("approvalStatus");
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_attendanceDate_key" ON "AttendanceRecord"("employeeId", "attendanceDate");
CREATE INDEX "AttendanceRecord_attendanceDate_status_idx" ON "AttendanceRecord"("attendanceDate", "status");
CREATE INDEX "AttendanceRecord_approvalStatus_idx" ON "AttendanceRecord"("approvalStatus");
CREATE INDEX "LeavePolicy_leaveType_activeStatus_idx" ON "LeavePolicy"("leaveType", "activeStatus");
CREATE INDEX "LeavePolicy_employmentType_effectiveStartDate_effectiveEndDate_idx" ON "LeavePolicy"("employmentType", "effectiveStartDate", "effectiveEndDate");
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveType_periodStart_periodEnd_key" ON "LeaveBalance"("employeeId", "leaveType", "periodStart", "periodEnd");
CREATE INDEX "LeaveBalance_employeeId_leaveType_idx" ON "LeaveBalance"("employeeId", "leaveType");
CREATE INDEX "LeaveBalanceAdjustment_employeeId_leaveType_idx" ON "LeaveBalanceAdjustment"("employeeId", "leaveType");
CREATE INDEX "LeaveBalanceAdjustment_approvalStatus_idx" ON "LeaveBalanceAdjustment"("approvalStatus");
CREATE INDEX "KpiImportTemplate_activeStatus_idx" ON "KpiImportTemplate"("activeStatus");
CREATE INDEX "KpiEvaluationWeight_metricId_activeStatus_idx" ON "KpiEvaluationWeight"("metricId", "activeStatus");
CREATE INDEX "KpiEvaluationWeight_applicableRole_applicableDepartmentId_idx" ON "KpiEvaluationWeight"("applicableRole", "applicableDepartmentId");
CREATE INDEX "EmailTemplate_notificationType_activeStatus_idx" ON "EmailTemplate"("notificationType", "activeStatus");
CREATE INDEX "EmailDeliveryLog_recipientUserId_createdAt_idx" ON "EmailDeliveryLog"("recipientUserId", "createdAt");
CREATE INDEX "EmailDeliveryLog_status_createdAt_idx" ON "EmailDeliveryLog"("status", "createdAt");
CREATE INDEX "DataRetentionPolicy_entityType_activeStatus_idx" ON "DataRetentionPolicy"("entityType", "activeStatus");
CREATE INDEX "IntegrationToken_activeStatus_expiresAt_idx" ON "IntegrationToken"("activeStatus", "expiresAt");
CREATE INDEX "IntegrationEventLog_eventType_status_idx" ON "IntegrationEventLog"("eventType", "status");
CREATE INDEX "IntegrationEventLog_entityType_entityId_idx" ON "IntegrationEventLog"("entityType", "entityId");
CREATE UNIQUE INDEX "ProductionReadinessCheck_key_key" ON "ProductionReadinessCheck"("key");
