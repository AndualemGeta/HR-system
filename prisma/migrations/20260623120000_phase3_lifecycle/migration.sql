-- Phase 3 HR lifecycle workflow foundation.

ALTER TYPE "DisciplinaryStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "DisciplinaryStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "DisciplinaryStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "DisciplinaryStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "DisciplinaryStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DisciplinaryStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';

ALTER TYPE "TerminationType" ADD VALUE IF NOT EXISTS 'PROBATION_FAILED';
ALTER TYPE "TerminationType" ADD VALUE IF NOT EXISTS 'ABSCONDING';
ALTER TYPE "TerminationType" ADD VALUE IF NOT EXISTS 'DEATH';

CREATE TYPE "TerminationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXIT_IN_PROGRESS',
  'EXIT_COMPLETED',
  'CANCELLED'
);

CREATE TYPE "FinalPaymentStatus" AS ENUM (
  'NOT_STARTED',
  'PENDING_REVIEW',
  'APPROVED',
  'PAID',
  'ON_HOLD',
  'NOT_APPLICABLE'
);

CREATE TYPE "ClearanceStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED'
);

CREATE TYPE "TransferRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED'
);

CREATE TYPE "PromotionRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED'
);

CREATE TYPE "ApprovalWorkflowType" AS ENUM (
  'DISCIPLINARY',
  'TERMINATION',
  'TRANSFER',
  'PROMOTION',
  'LEAVE',
  'ACHIEVEMENT',
  'EVALUATION',
  'IMPORT',
  'OTHER'
);

CREATE TYPE "ApprovalRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'IN_PROGRESS',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'CANCELLED'
);

CREATE TYPE "ApprovalActionType" AS ENUM (
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'REQUEST_CHANGES',
  'CANCEL'
);

CREATE TYPE "NotificationType" AS ENUM (
  'APPROVAL_REQUIRED',
  'APPROVAL_COMPLETED',
  'REQUEST_REJECTED',
  'REQUEST_CHANGES',
  'STATUS_CHANGED',
  'DOCUMENT_UPLOADED',
  'TERMINATION_APPROVED',
  'TRANSFER_APPROVED',
  'PROMOTION_APPROVED',
  'DISCIPLINARY_ESCALATED',
  'SYSTEM'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_SUBMISSION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_CLOSE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ESCALATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ATTACHMENT_UPLOAD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ATTACHMENT_VIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_ATTACHMENT_DOWNLOAD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_SUBMISSION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_CANCELLATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_COMPLETE_EXIT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_FINAL_PAYMENT_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_CLEARANCE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TERMINATION_EXIT_CHECKLIST_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_ACCOUNT_DEACTIVATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSFER_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSFER_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSFER_SUBMISSION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSFER_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSFER_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSFER_COMPLETION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_SUBMISSION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_COMPLETION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVAL_WORKFLOW_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVAL_ACTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'NOTIFICATION_READ';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EXPORT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SELF_SERVICE_REQUEST';

ALTER TABLE "DisciplinaryRecord"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "DisciplinaryRecord_incidentType_idx" ON "DisciplinaryRecord"("incidentType");

ALTER TABLE "TerminationCase"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "clearanceStatus" "ClearanceStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "exitInterviewStatus" "ClearanceStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "status" "TerminationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "notes" TEXT;

ALTER TABLE "TerminationCase" ADD COLUMN "finalPaymentStatusNew" "FinalPaymentStatus" NOT NULL DEFAULT 'NOT_STARTED';
UPDATE "TerminationCase"
SET "finalPaymentStatusNew" = CASE "finalPaymentStatus"::text
  WHEN 'APPROVED' THEN 'APPROVED'::"FinalPaymentStatus"
  WHEN 'PENDING' THEN 'PENDING_REVIEW'::"FinalPaymentStatus"
  WHEN 'REJECTED' THEN 'ON_HOLD'::"FinalPaymentStatus"
  WHEN 'CANCELLED' THEN 'ON_HOLD'::"FinalPaymentStatus"
  ELSE 'NOT_STARTED'::"FinalPaymentStatus"
END;
ALTER TABLE "TerminationCase" DROP COLUMN "finalPaymentStatus";
ALTER TABLE "TerminationCase" RENAME COLUMN "finalPaymentStatusNew" TO "finalPaymentStatus";

CREATE INDEX "TerminationCase_status_idx" ON "TerminationCase"("status");

ALTER TABLE "ExitChecklistItem" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "TransferRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "currentAssignmentId" TEXT,
  "requestedDivisionId" TEXT,
  "requestedDepartmentId" TEXT,
  "requestedRegionId" TEXT,
  "requestedShopId" TEXT,
  "requestedClusterId" TEXT,
  "requestedRole" "EmployeeRole",
  "requestedLevel" "EmployeeLevel",
  "requestedManagerId" TEXT,
  "reason" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3),
  "initiatedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "status" "TransferRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "currentRole" "EmployeeRole" NOT NULL,
  "currentLevel" "EmployeeLevel" NOT NULL,
  "proposedRole" "EmployeeRole",
  "proposedLevel" "EmployeeLevel",
  "proposedSalary" DECIMAL(12,2),
  "salaryEffectiveDate" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "supportingEvaluationId" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "initiatedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "status" "PromotionRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalWorkflow" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "workflowType" "ApprovalWorkflowType" NOT NULL,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalStep" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "approverRole" "SystemRole",
  "approverUserId" TEXT,
  "requiredPermission" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "canReject" BOOLEAN NOT NULL DEFAULT true,
  "canRequestChanges" BOOLEAN NOT NULL DEFAULT true,
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "requestedById" TEXT,
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalAction" (
  "id" TEXT NOT NULL,
  "approvalRequestId" TEXT NOT NULL,
  "stepId" TEXT,
  "actionById" TEXT,
  "action" "ApprovalActionType" NOT NULL,
  "comments" TEXT,
  "actionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "notificationType" "NotificationType" NOT NULL,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "readStatus" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransferRequest_employeeId_status_idx" ON "TransferRequest"("employeeId", "status");
CREATE INDEX "TransferRequest_status_idx" ON "TransferRequest"("status");
CREATE INDEX "PromotionRequest_employeeId_status_idx" ON "PromotionRequest"("employeeId", "status");
CREATE INDEX "PromotionRequest_status_idx" ON "PromotionRequest"("status");
CREATE INDEX "ApprovalWorkflow_workflowType_activeStatus_idx" ON "ApprovalWorkflow"("workflowType", "activeStatus");
CREATE UNIQUE INDEX "ApprovalStep_workflowId_stepOrder_key" ON "ApprovalStep"("workflowId", "stepOrder");
CREATE INDEX "ApprovalStep_workflowId_activeStatus_idx" ON "ApprovalStep"("workflowId", "activeStatus");
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");
CREATE INDEX "ApprovalAction_approvalRequestId_idx" ON "ApprovalAction"("approvalRequestId");
CREATE INDEX "ApprovalAction_action_idx" ON "ApprovalAction"("action");
CREATE INDEX "Notification_recipientUserId_readStatus_idx" ON "Notification"("recipientUserId", "readStatus");
CREATE INDEX "Notification_relatedEntityType_relatedEntityId_idx" ON "Notification"("relatedEntityType", "relatedEntityId");

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRequest" ADD CONSTRAINT "PromotionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
