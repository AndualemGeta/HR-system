-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN', 'CEO', 'CEO_COORDINATOR', 'HR_ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'FINANCE_DIRECTOR', 'FINANCE_PAYROLL', 'TREASURY_MANAGER', 'FINANCIAL_CONTROL_REPORTING_MANAGER', 'DISTRIBUTION_MANAGER', 'DISTRIBUTION_OFFICER', 'TECHNOLOGY_MANAGER', 'SALES_HEAD', 'AREA_SALES_MANAGER', 'SHOP_MANAGER', 'EMPLOYEE', 'AUDITOR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'COMMISSION_BASED', 'CONTRACT', 'INTERN', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('DRAFT', 'ONBOARDING', 'ACTIVE', 'ON_PROBATION', 'SUSPENDED', 'ON_LEAVE', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'EXITED');

-- CreateEnum
CREATE TYPE "ProbationStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'IN_PROGRESS', 'PASSED', 'EXTENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('CEO', 'CEO_COORDINATOR', 'SALES_HEAD', 'AREA_SALES_MANAGER', 'SHOP_MANAGER', 'SHOP_ACCOUNTANT', 'DSA', 'DSP', 'BA_COORDINATOR', 'CLEANING_STAFF', 'SECURITY_STAFF', 'EBU_SUPERVISOR', 'EBU_FTTH_SUPERVISOR', 'EBU_TECHNICAL_SALES_LEAD', 'EBU_FTTH_SALES', 'DISTRIBUTION_MANAGER', 'DISTRIBUTION_OFFICER', 'FINANCE_DIRECTOR', 'TREASURY_MANAGER', 'ACCOUNTANT', 'FINANCIAL_CONTROL_REPORTING_MANAGER', 'HR_MANAGER', 'HR_OFFICER', 'TECHNOLOGY_MANAGER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE', 'TO_BE_DEFINED');

-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('COMPANY', 'EXECUTIVE_OFFICE', 'DIVISION', 'DEPARTMENT', 'TEAM', 'UNIT');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('DIVISION', 'REGION', 'SHOP', 'CLUSTER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('PROBATION_EVALUATION', 'MONTHLY_PERFORMANCE_REVIEW', 'QUARTERLY_PERFORMANCE_REVIEW', 'ANNUAL_REVIEW', 'SHOP_MANAGER_EVALUATION', 'DISCIPLINARY_FOLLOW_UP', 'PROMOTION_READINESS', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('SALES_TARGET_ACHIEVED', 'TOP_PERFORMER', 'ATTENDANCE_EXCELLENCE', 'CUSTOMER_SERVICE_RECOGNITION', 'LEADERSHIP_RECOGNITION', 'TRAINING_COMPLETED', 'DISCIPLINARY_IMPROVEMENT', 'PROCESS_IMPROVEMENT', 'FINANCIAL_COMPLIANCE', 'TECHNOLOGY_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID', 'CONTRACT', 'CV', 'CERTIFICATE', 'WARNING_LETTER', 'TERMINATION_LETTER', 'RESIGNATION_LETTER', 'CLEARANCE', 'EVALUATION_DOCUMENT', 'SALARY_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('STANDARD', 'HR_ONLY', 'FINANCE_ONLY', 'SENIOR_ONLY', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "DisciplinaryStatus" AS ENUM ('OPEN', 'FOLLOW_UP_REQUIRED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPASSIONATE', 'OTHER');

-- CreateEnum
CREATE TYPE "TerminationType" AS ENUM ('RESIGNATION', 'TERMINATION_FOR_CAUSE', 'END_OF_CONTRACT', 'REDUNDANCY', 'RETIREMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'APPROVED', 'REJECTED', 'PARTIALLY_IMPORTED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('CLEAN', 'WARNING', 'REVIEW_REQUIRED', 'BLOCKED', 'IMPORTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'SALARY_CHANGE', 'STATUS_CHANGE', 'ASSIGNMENT_CHANGE', 'EVALUATOR_CHANGE', 'EMPLOYMENT_TYPE_CHANGE', 'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'ACHIEVEMENT_APPROVAL', 'EVALUATION_SUBMISSION', 'EVALUATION_APPROVAL', 'DISCIPLINARY_ACTION', 'TERMINATION_APPROVAL', 'IMPORT_APPROVAL', 'USER_PERMISSION_CHANGE', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "employeeId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "SystemRole" NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "OrgUnitType" NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "headId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "dateOfBirth" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "email" TEXT,
    "address" TEXT,
    "hireDate" TIMESTAMP(3),
    "employmentType" "EmploymentType",
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'DRAFT',
    "probationStatus" "ProbationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "currentDepartmentId" TEXT,
    "currentDivisionId" TEXT,
    "currentRegionId" TEXT,
    "currentShopId" TEXT,
    "currentClusterId" TEXT,
    "currentRole" "EmployeeRole" NOT NULL DEFAULT 'OTHER',
    "sourceRoleValue" TEXT,
    "currentLevel" "EmployeeLevel" NOT NULL DEFAULT 'TO_BE_DEFINED',
    "directManagerId" TEXT,
    "currentEvaluatorId" TEXT,
    "basicSalary" DECIMAL(12,2),
    "salaryEffectiveDate" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "divisionId" TEXT,
    "departmentId" TEXT,
    "regionId" TEXT,
    "shopId" TEXT,
    "clusterId" TEXT,
    "role" "EmployeeRole" NOT NULL,
    "sourceRoleValue" TEXT,
    "level" "EmployeeLevel" NOT NULL DEFAULT 'TO_BE_DEFINED',
    "directManagerId" TEXT,
    "evaluatorId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatusHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousStatus" "EmploymentStatus",
    "newStatus" "EmploymentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluationPeriodStart" TIMESTAMP(3) NOT NULL,
    "evaluationPeriodEnd" TIMESTAMP(3) NOT NULL,
    "evaluationType" "EvaluationType" NOT NULL,
    "score" DECIMAL(5,2),
    "rating" TEXT,
    "comments" TEXT,
    "strengths" TEXT,
    "improvementAreas" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedDate" TIMESTAMP(3),
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "attachmentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriteria" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "applicableRole" "EmployeeRole",
    "applicableDepartmentId" TEXT,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibilityLevel" "DocumentVisibility" NOT NULL DEFAULT 'STANDARD',
    "notes" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "achievementType" "AchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achievementDate" TIMESTAMP(3) NOT NULL,
    "divisionId" TEXT,
    "departmentId" TEXT,
    "regionId" TEXT,
    "shopId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "attachmentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "warningLevel" TEXT,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "issuedById" TEXT,
    "attachmentPath" TEXT,
    "followUpDate" TIMESTAMP(3),
    "status" "DisciplinaryStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplinaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminationCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "terminationType" "TerminationType" NOT NULL,
    "reason" TEXT NOT NULL,
    "noticeDate" TIMESTAMP(3),
    "lastWorkingDate" TIMESTAMP(3),
    "initiatedById" TEXT,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "finalPaymentStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitChecklistItem" (
    "id" TEXT NOT NULL,
    "terminationCaseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExitChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "cleanRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "reviewRows" INTEGER NOT NULL DEFAULT 0,
    "blockedRows" INTEGER NOT NULL DEFAULT 0,
    "columnMapping" JSONB,
    "validationReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "blockers" JSONB,
    "warnings" JSONB,
    "reviewItems" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "createdEmployeeId" TEXT,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON "OrganizationUnit"("code");

-- CreateIndex
CREATE INDEX "OrganizationUnit_parentId_idx" ON "OrganizationUnit"("parentId");

-- CreateIndex
CREATE INDEX "OrganizationUnit_type_idx" ON "OrganizationUnit"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_employmentStatus_idx" ON "Employee"("employmentStatus");

-- CreateIndex
CREATE INDEX "Employee_currentRole_idx" ON "Employee"("currentRole");

-- CreateIndex
CREATE INDEX "Employee_currentDepartmentId_idx" ON "Employee"("currentDepartmentId");

-- CreateIndex
CREATE INDEX "Employee_currentRegionId_idx" ON "Employee"("currentRegionId");

-- CreateIndex
CREATE INDEX "Employee_currentShopId_idx" ON "Employee"("currentShopId");

-- CreateIndex
CREATE INDEX "Employee_directManagerId_idx" ON "Employee"("directManagerId");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_employeeId_endDate_idx" ON "EmployeeAssignment"("employeeId", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_directManagerId_idx" ON "EmployeeAssignment"("directManagerId");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_evaluatorId_idx" ON "EmployeeAssignment"("evaluatorId");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_employeeId_effectiveDate_idx" ON "EmployeeStatusHistory"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeEvaluation_employeeId_status_idx" ON "EmployeeEvaluation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeEvaluation_evaluatorId_idx" ON "EmployeeEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "EmployeeSalary_employeeId_effectiveDate_idx" ON "EmployeeSalary"("employeeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklist_employeeId_key" ON "OnboardingChecklist"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklistItem_checklistId_key_key" ON "OnboardingChecklistItem"("checklistId", "key");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_documentType_idx" ON "EmployeeDocument"("employeeId", "documentType");

-- CreateIndex
CREATE INDEX "Achievement_employeeId_approvalStatus_idx" ON "Achievement"("employeeId", "approvalStatus");

-- CreateIndex
CREATE INDEX "DisciplinaryRecord_employeeId_status_idx" ON "DisciplinaryRecord"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveRecord_employeeId_startDate_idx" ON "LeaveRecord"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "TerminationCase_employeeId_approvalStatus_idx" ON "TerminationCase"("employeeId", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ExitChecklistItem_terminationCaseId_key_key" ON "ExitChecklistItem"("terminationCaseId", "key");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportRow_status_idx" ON "ImportRow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_importBatchId_rowNumber_key" ON "ImportRow"("importBatchId", "rowNumber");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentDivisionId_fkey" FOREIGN KEY ("currentDivisionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentRegionId_fkey" FOREIGN KEY ("currentRegionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentShopId_fkey" FOREIGN KEY ("currentShopId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentClusterId_fkey" FOREIGN KEY ("currentClusterId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_directManagerId_fkey" FOREIGN KEY ("directManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentEvaluatorId_fkey" FOREIGN KEY ("currentEvaluatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriteria" ADD CONSTRAINT "EvaluationCriteria_applicableDepartmentId_fkey" FOREIGN KEY ("applicableDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryRecord" ADD CONSTRAINT "DisciplinaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRecord" ADD CONSTRAINT "LeaveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminationCase" ADD CONSTRAINT "TerminationCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitChecklistItem" ADD CONSTRAINT "ExitChecklistItem_terminationCaseId_fkey" FOREIGN KEY ("terminationCaseId") REFERENCES "TerminationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
