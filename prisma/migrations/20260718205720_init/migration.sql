-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'COMMISSION_BASED', 'CONTRACT', 'INTERN', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('DRAFT', 'ONBOARDING', 'ACTIVE', 'ON_PROBATION', 'SUSPENDED', 'ON_LEAVE', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'EXITED');

-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('HEAD_OFFICE', 'SHOP_FIELD');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('CEO', 'CEO_COORDINATOR', 'SALES_HEAD', 'ASM', 'SHOP_MANAGER', 'SHOP_ACCOUNTANT', 'DSA', 'DSP', 'BA_COORDINATOR', 'BUSINESS_DEVELOPMENT_MANAGER', 'CLEANING_STAFF', 'SECURITY_STAFF', 'EBU_SUPERVISOR', 'EBU_FTTH_SUPERVISOR', 'EBU_TECHNICAL_SALES_LEAD', 'EBU_FTTH_SALES', 'DISTRIBUTION_MANAGER', 'DISTRIBUTION_OFFICER', 'FINANCE_DIRECTOR', 'TREASURY_MANAGER', 'ACCOUNTANT', 'FINANCIAL_CONTROL_REPORTING_MANAGER', 'HR_MANAGER', 'HR_OFFICER', 'TECHNOLOGY_MANAGER', 'EMPLOYEE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE', 'TO_BE_DEFINED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('DIVISION', 'REGION', 'AREA', 'SHOP', 'CLUSTER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID', 'CONTRACT', 'CV', 'CERTIFICATE', 'EMERGENCY_CONTACT', 'BANK_OR_PAYMENT_INFORMATION', 'TAX_OR_PAYROLL_INFORMATION', 'COMMISSION_AGREEMENT', 'ASSIGNMENT_LETTER', 'RESPONSIBILITY_DOCUMENT', 'CONFIDENTIALITY_DOCUMENT', 'WARNING_LETTER', 'TERMINATION_LETTER', 'RESIGNATION_LETTER', 'CLEARANCE', 'EVALUATION_DOCUMENT', 'SALARY_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC_TO_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE', 'SENSITIVE_HR_ONLY', 'SALARY_RESTRICTED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'EMERGENCY', 'COMPASSIONATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('PROBATION', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'SHOP_MANAGER', 'DISCIPLINARY_FOLLOW_UP', 'PROMOTION_READINESS', 'COMMISSION_REVIEW', 'SALARY_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisciplinaryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TerminationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXIT_IN_PROGRESS', 'EXIT_COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalaryReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HR_REVIEW', 'FINANCE_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PayrollBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollCalculationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PayrollReadiness" AS ENUM ('READY', 'WARNING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PayrollLockStatus" AS ENUM ('UNLOCKED', 'LOCKED', 'UNLOCK_REQUESTED');

-- CreateEnum
CREATE TYPE "CalculationLineType" AS ENUM ('BASIC_SALARY', 'EARNING', 'ALLOWANCE', 'COMMISSION', 'BONUS', 'OVERTIME', 'ADJUSTMENT', 'EMPLOYEE_PENSION', 'EMPLOYER_PENSION', 'PAYE_TAX', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "CalculationSourceType" AS ENUM ('EMPLOYEE_SALARY', 'PAYROLL_INPUT', 'PAY_RULE', 'PAYROLL_ADJUSTMENT', 'ATTENDANCE', 'STATUTORY_RULE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PensionBaseType" AS ENUM ('BASIC_SALARY', 'PENSIONABLE_EARNINGS', 'CUSTOM_COMPONENTS');

-- CreateEnum
CREATE TYPE "CommissionCalculationType" AS ENUM ('FIXED_AMOUNT', 'PERCENT_OF_SALES', 'TIERED_PERCENT', 'TARGET_BASED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommissionCalculationStatus" AS ENUM ('DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AllowanceType" AS ENUM ('KPI_ALLOWANCE', 'TRANSPORT_ALLOWANCE', 'HOUSING_ALLOWANCE', 'POSITION_ALLOWANCE', 'MEAL_ALLOWANCE', 'COMMUNICATION_ALLOWANCE', 'OTHER_ALLOWANCE');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('LOAN_DEDUCTION', 'ADVANCE_DEDUCTION', 'ABSENCE_DEDUCTION', 'DAMAGE_DEDUCTION', 'PENALTY_DEDUCTION', 'OTHER_DEDUCTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL_REQUIRED', 'APPROVAL_COMPLETED', 'REQUEST_REJECTED', 'CHANGES_REQUESTED', 'DOCUMENT_UPLOADED', 'REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PayComponentType" AS ENUM ('BASIC_SALARY', 'ALLOWANCE', 'KPI', 'TRANSPORT', 'OVERTIME', 'COMMISSION', 'BONUS', 'ADJUSTMENT', 'DEDUCTION', 'STATUTORY', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('TAXABLE', 'NON_TAXABLE', 'PARTIALLY_TAXABLE', 'STATUTORY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeductionTiming" AS ENUM ('NOT_APPLICABLE', 'PRE_TAX', 'POST_TAX');

-- CreateEnum
CREATE TYPE "PayRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PayRuleType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'THRESHOLD', 'TIERED', 'PER_UNIT', 'MANUAL_INPUT', 'FORMULA', 'CAP_ONLY');

-- CreateEnum
CREATE TYPE "ThresholdMetric" AS ENUM ('SALES_ACHIEVEMENT_PERCENT', 'DAILY_ACTIVE_MERCHANT', 'GA_COUNT', 'QGA_COUNT', 'RECHARGE_COUNT', 'ATTENDANCE_DAYS', 'OVERTIME_HOURS', 'MANUAL_VALUE');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'OPEN_FOR_INPUT', 'INPUT_COLLECTION_CLOSED', 'REVIEW_IN_PROGRESS', 'READY_FOR_CALCULATION', 'READY_FOR_REVIEW', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollInputTypeCategory" AS ENUM ('ALLOWANCE', 'DEDUCTION', 'COMMISSION', 'KPI', 'TRANSPORT', 'OVERTIME', 'BONUS', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollInputTypeValueType" AS ENUM ('AMOUNT', 'NUMBER', 'PERCENTAGE', 'BOOLEAN', 'TEXT');

-- CreateEnum
CREATE TYPE "PayrollInputCalculationMode" AS ENUM ('DIRECT_AMOUNT', 'METRIC_ONLY', 'RULE_DERIVED');

-- CreateEnum
CREATE TYPE "PayrollInputSource" AS ENUM ('MANUAL', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PayrollInputStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CorridorType" AS ENUM ('CORRIDOR', 'NON_CORRIDOR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ShopCriteria" AS ENUM ('GOLD', 'SILVER', 'BRONZE', 'AT_RISK', 'UNASSIGNED');

-- CreateEnum
CREATE TYPE "IncentivePeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CALCULATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_STATUS_CHANGE', 'SALARY_CHANGE', 'ASSIGNMENT_CHANGE', 'MANAGER_CHANGE', 'ACCOUNTING_MANAGER_CHANGE', 'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DEACTIVATE', 'LEAVE_CREATE', 'LEAVE_APPROVAL', 'LEAVE_REJECTION', 'EVALUATION_CREATE', 'EVALUATION_SUBMIT', 'EVALUATION_APPROVAL', 'EVALUATION_REJECTION', 'DISCIPLINARY_CREATE', 'DISCIPLINARY_APPROVAL', 'TERMINATION_CREATE', 'TERMINATION_APPROVAL', 'TERMINATION_COMPLETE_EXIT', 'TRANSFER_CREATE', 'TRANSFER_APPROVAL', 'TRANSFER_COMPLETE', 'PROMOTION_CREATE', 'PROMOTION_APPROVAL', 'PROMOTION_COMPLETE', 'SALARY_REVIEW_CREATE', 'SALARY_REVIEW_APPROVAL', 'SALARY_REVIEW_COMPLETE', 'COMMISSION_CREATE', 'COMMISSION_APPROVAL', 'PAYROLL_BATCH_CREATE', 'PAYROLL_BATCH_APPROVE', 'PAYROLL_BATCH_EXPORT', 'PAYROLL_PERIOD_LOCK', 'PAYROLL_ADJUSTMENT', 'IMPORT_UPLOAD', 'IMPORT_APPROVE', 'EXPORT_CREATE', 'USER_CREATE', 'USER_PERMISSION_CHANGE', 'SYSTEM_SETTING_UPDATE', 'PROFILE_CHANGE_REQUEST', 'PROFILE_CHANGE_APPROVAL', 'DATA_QUALITY_RESOLVE', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_UPDATE', 'DOCUMENT_RULE_CREATE', 'DOCUMENT_RULE_UPDATE', 'DOCUMENT_RULE_DEACTIVATE', 'ONBOARDING_UPDATE', 'ONBOARDING_COMPLETE', 'ONBOARDING_OVERRIDE', 'EMPLOYEE_IMPORT_PREVIEW', 'EMPLOYEE_IMPORT_CONFIRM', 'EMPLOYEE_IMPORT_CREATE', 'EMPLOYEE_IMPORT_UPDATE', 'EMPLOYEE_IMPORT_SKIP', 'PAYROLL_READINESS_VIEW', 'PAYROLL_READINESS_EXPORT', 'PAYROLL_PROFILE_UPDATE', 'PAY_COMPONENT_CREATE', 'PAY_COMPONENT_UPDATE', 'PAY_COMPONENT_DEACTIVATE', 'PAY_RULE_CREATE', 'PAY_RULE_UPDATE', 'PAY_RULE_ACTIVATE', 'PAY_RULE_DEACTIVATE', 'PAY_RULE_PREVIEW', 'DATA_QUALITY_SCAN', 'DATA_QUALITY_IGNORE', 'CHANGE_REQUEST_CREATE', 'CHANGE_REQUEST_APPROVE', 'CHANGE_REQUEST_APPLY', 'CHANGE_REQUEST_REJECT', 'CHANGE_REQUEST_CANCEL', 'SALARY_RULE_APPROVAL_REQUEST', 'SALARY_RULE_APPROVAL_APPROVE', 'SALARY_RULE_APPROVAL_REJECT', 'PHASE_CONTROL_UPDATE', 'PAYROLL_PERIOD_CREATE', 'PAYROLL_PERIOD_UPDATE', 'PAYROLL_PERIOD_OPEN', 'PAYROLL_PERIOD_CLOSE', 'PAYROLL_PERIOD_CANCEL', 'PAYROLL_EMPLOYEE_ADD', 'PAYROLL_EMPLOYEE_REMOVE', 'PAYROLL_INPUT_TYPE_CREATE', 'PAYROLL_INPUT_TYPE_UPDATE', 'PAYROLL_INPUT_TYPE_DEACTIVATE', 'PAYROLL_INPUT_CREATE', 'PAYROLL_INPUT_UPDATE', 'PAYROLL_INPUT_SUBMIT', 'PAYROLL_INPUT_ACCEPT', 'PAYROLL_INPUT_REJECT', 'PAYROLL_INPUT_RETURN', 'PAYROLL_INPUT_IMPORT_PREVIEW', 'PAYROLL_INPUT_IMPORT_CONFIRM', 'PAYROLL_INPUT_REQUIREMENT_CREATE', 'PAYROLL_INPUT_REQUIREMENT_UPDATE', 'PAYROLL_INPUT_REQUIREMENT_DEACTIVATE', 'PAYROLL_MISSING_INPUT_CHECK', 'PAYROLL_INPUT_LOCK', 'PAYROLL_INPUT_UNLOCK', 'PAYROLL_INPUT_LOCK_ACCEPTED', 'PAYROLL_INPUT_WAIVER_CREATE', 'PAYROLL_INPUT_WAIVER_DEACTIVATE', 'PAYROLL_PERIOD_REVIEW_START', 'PAYROLL_PERIOD_READY_FOR_CALCULATION', 'PAYROLL_PREPARATION_SUMMARY_EXPORT', 'SHOP_CREATE', 'SHOP_UPDATE', 'SHOP_DEACTIVATE', 'SHOP_REACTIVATE', 'SHOP_MANAGER_ASSIGN', 'SHOP_CRITERIA_UPDATE', 'SHOP_PROFILE_UPDATE', 'SHOP_MANAGER_INCENTIVE_PERIOD_CREATE', 'SHOP_MANAGER_INCENTIVE_PERIOD_UPDATE', 'SHOP_MANAGER_INCENTIVE_PERIOD_OPEN', 'SHOP_MANAGER_INCENTIVE_INPUT_CREATE', 'SHOP_MANAGER_INCENTIVE_INPUT_UPDATE', 'SHOP_MANAGER_INCENTIVE_INPUT_DELETE', 'SHOP_MANAGER_INCENTIVE_CALCULATE', 'SHOP_MANAGER_INCENTIVE_EXPORT', 'SHOP_MANAGER_INCENTIVE_SEND_TO_PAYROLL', 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_UPDATE', 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_ACTIVATE', 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_DEACTIVATE', 'SHOP_MANAGER_INCENTIVE_READINESS_VALIDATE', 'SHOP_MANAGER_INCENTIVE_RECALCULATION_REQUIRED', 'SHOP_MANAGER_INCENTIVE_PAYROLL_TOTAL_CREATE', 'SHOP_MANAGER_INCENTIVE_PAYROLL_TOTAL_UPDATE', 'SHOP_MANAGER_INCENTIVE_PAYROLL_HANDOFF_BLOCKED', 'PAYROLL_STATUTORY_PAYE_CREATE', 'PAYROLL_STATUTORY_PAYE_UPDATE', 'PAYROLL_STATUTORY_PAYE_APPROVE', 'PAYROLL_STATUTORY_PAYE_DEACTIVATE', 'PAYROLL_STATUTORY_PENSION_CREATE', 'PAYROLL_STATUTORY_PENSION_UPDATE', 'PAYROLL_STATUTORY_PENSION_APPROVE', 'PAYROLL_STATUTORY_PENSION_DEACTIVATE', 'PAYROLL_CALCULATION_READINESS_RUN', 'PAYROLL_CALCULATION_PREVIEW', 'PAYROLL_CALCULATION_START', 'PAYROLL_CALCULATION_COMPLETE', 'PAYROLL_CALCULATION_BLOCKED', 'PAYROLL_CALCULATION_REVIEW_START', 'PAYROLL_CALCULATION_APPROVE', 'PAYROLL_CALCULATION_RETURN', 'PAYROLL_CALCULATION_REOPEN', 'PAYROLL_CALCULATION_VALIDATE', 'PAYROLL_CALCULATION_EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('CREATE_ONLY', 'UPDATE_ONLY', 'CREATE_OR_UPDATE');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR', 'DUPLICATE', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
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
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "headId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProfile" (
    "id" TEXT NOT NULL,
    "shopLocationId" TEXT NOT NULL,
    "corridorType" "CorridorType" NOT NULL DEFAULT 'UNKNOWN',
    "defaultShopManagerId" TEXT,
    "isIncentiveEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "ShopProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCriteriaStatusHistory" (
    "id" TEXT NOT NULL,
    "shopLocationId" TEXT NOT NULL,
    "criteria" "ShopCriteria" NOT NULL DEFAULT 'UNASSIGNED',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCriteriaStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'NOT_SPECIFIED',
    "dateOfBirth" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "email" TEXT,
    "address" TEXT,
    "hireDate" TIMESTAMP(3),
    "employmentType" "EmploymentType",
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeCategory" "EmployeeCategory",
    "probationStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "currentDepartmentId" TEXT,
    "currentDivisionId" TEXT,
    "currentRegionId" TEXT,
    "currentAreaId" TEXT,
    "currentShopId" TEXT,
    "currentClusterId" TEXT,
    "currentRole" "EmployeeRole" NOT NULL DEFAULT 'OTHER',
    "currentLevel" "EmployeeLevel" NOT NULL DEFAULT 'TO_BE_DEFINED',
    "directManagerId" TEXT,
    "accountingReportingManagerId" TEXT,
    "basicSalary" DECIMAL(12,2),
    "salaryEffectiveDate" TIMESTAMP(3),
    "notes" TEXT,
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
    "employeeCategory" "EmployeeCategory",
    "departmentId" TEXT,
    "divisionId" TEXT,
    "regionId" TEXT,
    "areaId" TEXT,
    "shopId" TEXT,
    "clusterId" TEXT,
    "role" "EmployeeRole" NOT NULL,
    "level" "EmployeeLevel" NOT NULL DEFAULT 'TO_BE_DEFINED',
    "directManagerId" TEXT,
    "accountingReportingManagerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeStatusHistory_pkey" PRIMARY KEY ("id")
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
    "originalFilename" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibilityLevel" "DocumentVisibility" NOT NULL DEFAULT 'PUBLIC_TO_HR',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "deactivationReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredDocumentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "applicableEmploymentType" "EmploymentType",
    "applicableRole" "EmployeeRole",
    "applicableDepartmentId" TEXT,
    "applicableDivisionId" TEXT,
    "applicableEmployeeCategory" "EmployeeCategory",
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequiredDocumentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" DECIMAL(6,2),
    "reason" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "employmentType" "EmploymentType",
    "annualEntitlementDays" DECIMAL(8,2) NOT NULL,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForwardDays" DECIMAL(8,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "LeaveBalanceAdjustment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "adjustmentDays" DECIMAL(8,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalanceAdjustment_pkey" PRIMARY KEY ("id")
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
    "attachmentPath" TEXT,
    "compensationRecommendation" TEXT NOT NULL DEFAULT 'NO_CHANGE',
    "salaryReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "commissionReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achievementDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "attachmentPath" TEXT,
    "followUpDate" TIMESTAMP(3),
    "status" "DisciplinaryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminationCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "terminationType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "noticeDate" TIMESTAMP(3),
    "lastWorkingDate" TIMESTAMP(3),
    "initiatedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "status" "TerminationStatus" NOT NULL DEFAULT 'DRAFT',
    "finalPaymentStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "clearanceStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "exitInterviewStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "initiatedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currentRole" "EmployeeRole" NOT NULL,
    "currentLevel" "EmployeeLevel" NOT NULL,
    "proposedRole" "EmployeeRole",
    "proposedLevel" "EmployeeLevel",
    "proposedSalary" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "initiatedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" TEXT,
    "approverUserId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "preventSelfApproval" BOOLEAN NOT NULL DEFAULT true,
    "escalationAfterDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestedById" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "stepId" TEXT,
    "actionById" TEXT,
    "action" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "SalaryReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currentSalary" DECIMAL(12,2),
    "proposedSalary" DECIMAL(12,2) NOT NULL,
    "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changePercent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "relatedEvaluationId" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "status" "SalaryReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "hrReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "financeReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "applicableRole" "EmployeeRole",
    "calculationType" "CommissionCalculationType" NOT NULL,
    "rate" DECIMAL(10,4),
    "fixedAmount" DECIMAL(12,2),
    "capAmount" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionCalculation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "commissionPlanId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "salesAmount" DECIMAL(12,2),
    "targetAmount" DECIMAL(12,2),
    "achievementPercent" DECIMAL(8,2),
    "calculatedCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "manualAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "manualAdjustmentReason" TEXT,
    "finalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CommissionCalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRule" (
    "id" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rate" DECIMAL(10,4),
    "amount" DECIMAL(12,2),
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "changeReason" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayeTaxBracket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleCode" TEXT,
    "minIncome" DECIMAL(12,2) NOT NULL,
    "maxIncome" DECIMAL(12,2),
    "taxRate" DECIMAL(10,4) NOT NULL,
    "deductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayeTaxBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PensionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeRate" DECIMAL(10,4) NOT NULL,
    "employerRate" DECIMAL(10,4) NOT NULL,
    "pensionBaseType" "PensionBaseType" NOT NULL DEFAULT 'BASIC_SALARY',
    "minimumBase" DECIMAL(12,2),
    "maximumBase" DECIMAL(12,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "applicableEmploymentType" "EmploymentType",
    "applicableRole" "EmployeeRole",
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PensionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAttendanceInput" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
    "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
    "workingDays" DECIMAL(8,2) NOT NULL,
    "daysPresent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "daysAbsent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "paidLeaveDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "unpaidLeaveDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "sundayOvertimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "holidayOvertimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "nightOvertimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAttendanceInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAllowance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
    "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
    "allowanceType" "AllowanceType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDeduction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
    "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
    "deductionType" "DeductionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isPreTax" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPreparationBatch" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "batchName" TEXT NOT NULL,
    "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
    "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
    "calculationStatus" "PayrollCalculationStatus" DEFAULT 'PENDING',
    "status" "PayrollBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationStartedAt" TIMESTAMP(3),
    "calculationCompletedAt" TIMESTAMP(3),
    "calculatedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "calculationHash" TEXT,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "blockerCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "grossEarningsTotal" DECIMAL(14,2),
    "taxableIncomeTotal" DECIMAL(14,2),
    "employeePensionTotal" DECIMAL(14,2),
    "employerPensionTotal" DECIMAL(14,2),
    "payeTaxTotal" DECIMAL(14,2),
    "otherDeductionTotal" DECIMAL(14,2),
    "netSalaryTotal" DECIMAL(14,2),
    "employerTotalCost" DECIMAL(14,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPreparationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPreparationRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "employmentType" TEXT,
    "division" TEXT,
    "department" TEXT,
    "region" TEXT,
    "shop" TEXT,
    "role" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2),
    "salarySource" TEXT,
    "salaryEffectiveDate" TIMESTAMP(3),
    "proratedBasicSalary" DECIMAL(12,2),
    "workingDays" DECIMAL(8,2),
    "daysPresent" DECIMAL(8,2),
    "paidLeaveDays" DECIMAL(8,2),
    "unpaidLeaveDays" DECIMAL(8,2),
    "grossTaxableEarnings" DECIMAL(12,2),
    "grossNonTaxableEarnings" DECIMAL(12,2),
    "pensionableIncome" DECIMAL(12,2),
    "approvedAllowances" DECIMAL(12,2),
    "approvedCommission" DECIMAL(12,2),
    "overtimeAmount" DECIMAL(12,2),
    "preTaxDeductions" DECIMAL(12,2),
    "postTaxDeductions" DECIMAL(12,2),
    "totalDeductions" DECIMAL(12,2),
    "grossSalary" DECIMAL(12,2),
    "taxableIncome" DECIMAL(12,2),
    "employeePension" DECIMAL(12,2),
    "employerPension" DECIMAL(12,2),
    "payeTax" DECIMAL(12,2),
    "netSalary" DECIMAL(12,2),
    "employerTotalCost" DECIMAL(12,2),
    "otherEmployerContributions" DECIMAL(12,2),
    "manualAdjustments" DECIMAL(12,2),
    "approvedDeductions" DECIMAL(12,2),
    "readinessStatus" "PayrollReadiness" NOT NULL,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "calculatedAt" TIMESTAMP(3),
    "calculatedById" TEXT,
    "blockers" JSONB,
    "warnings" JSONB,
    "calculationBreakdown" JSONB,
    "includedInExport" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPreparationRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollCalculationLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowId" TEXT,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "componentId" TEXT,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "lineType" "CalculationLineType" NOT NULL,
    "sourceType" "CalculationSourceType" NOT NULL,
    "sourceId" TEXT,
    "quantity" DECIMAL(12,4),
    "rate" DECIMAL(12,4),
    "baseAmount" DECIMAL(12,2),
    "grossAmount" DECIMAL(12,2) DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) DEFAULT 0,
    "nonTaxableAmount" DECIMAL(12,2) DEFAULT 0,
    "pensionableAmount" DECIMAL(12,2) DEFAULT 0,
    "deductionAmount" DECIMAL(12,2) DEFAULT 0,
    "employerAmount" DECIMAL(12,2) DEFAULT 0,
    "ruleId" TEXT,
    "calculationOrder" INTEGER NOT NULL DEFAULT 0,
    "calculationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollCalculationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriodLock" (
    "id" TEXT NOT NULL,
    "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
    "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
    "lockStatus" "PayrollLockStatus" NOT NULL DEFAULT 'UNLOCKED',
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "unlockRequestedById" TEXT,
    "unlockedById" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
    "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiMetric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "hoursWorked" DECIMAL(8,2),
    "overtimeHours" DECIMAL(8,2),
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "recordedById" TEXT,
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "employeeId" TEXT,
    "description" TEXT NOT NULL,
    "suggestedFix" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "ignoredById" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoreReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedField" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "reviewComment" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRuleApprovalRequest" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "requestReason" TEXT,
    "reviewComment" TEXT,
    "validationJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SalaryRuleApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseControlChecklist" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "owner" TEXT,
    "comment" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseControlChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "EmployeePayrollProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "mpesaAccount" TEXT,
    "taxId" TEXT,
    "pensionId" TEXT,
    "costCenter" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayComponent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "componentType" "PayComponentType" NOT NULL DEFAULT 'OTHER',
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'UNKNOWN',
    "isEarning" BOOLEAN NOT NULL DEFAULT true,
    "isDeduction" BOOLEAN NOT NULL DEFAULT false,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPensionable" BOOLEAN NOT NULL DEFAULT false,
    "taxablePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pensionablePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "affectsGross" BOOLEAN NOT NULL DEFAULT true,
    "affectsNet" BOOLEAN NOT NULL DEFAULT true,
    "affectsEmployerCost" BOOLEAN NOT NULL DEFAULT false,
    "calculationOrder" INTEGER NOT NULL DEFAULT 0,
    "deductionTiming" "DeductionTiming" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRule" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "employeeCategory" "EmployeeCategory",
    "role" "EmployeeRole",
    "departmentId" TEXT,
    "regionId" TEXT,
    "areaId" TEXT,
    "shopId" TEXT,
    "employmentType" "EmploymentType",
    "ruleType" "PayRuleType" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "calculationMethod" "PayRuleType" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "baseAmount" DECIMAL(12,2),
    "percentageRate" DECIMAL(8,4),
    "maxAmount" DECIMAL(12,2),
    "minAmount" DECIMAL(12,2),
    "thresholdValue" DECIMAL(12,4),
    "thresholdMetric" "ThresholdMetric",
    "tierConfigJson" TEXT,
    "formulaJson" TEXT,
    "requiresManualInput" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "PayRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importMode" "ImportMode" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" TEXT NOT NULL DEFAULT '[]',
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "matchedEmployeeId" TEXT,
    "rawRow" JSONB NOT NULL,
    "parsedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "periodName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollInputType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "PayrollInputTypeCategory" NOT NULL,
    "valueType" "PayrollInputTypeValueType" NOT NULL,
    "defaultAmount" DECIMAL(12,2),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "calculationMode" "PayrollInputCalculationMode" NOT NULL DEFAULT 'DIRECT_AMOUNT',
    "payComponentId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollInputType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriodEmployee" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PayrollPeriodEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollInput" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "inputTypeId" TEXT NOT NULL,
    "value" DECIMAL(12,2),
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "source" "PayrollInputSource" NOT NULL DEFAULT 'MANUAL',
    "status" "PayrollInputStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollInputRequirement" (
    "id" TEXT NOT NULL,
    "inputTypeId" TEXT NOT NULL,
    "employeeCategory" "EmployeeCategory",
    "role" "EmployeeRole",
    "departmentId" TEXT,
    "regionId" TEXT,
    "areaId" TEXT,
    "shopId" TEXT,
    "employmentType" "EmploymentType",
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'BLOCKER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollInputRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollInputWaiver" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "inputTypeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PayrollInputWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopManagerIncentivePeriod" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "IncentivePeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopManagerIncentivePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopManagerIncentiveInput" (
    "id" TEXT NOT NULL,
    "incentivePeriodId" TEXT NOT NULL,
    "shopLocationId" TEXT NOT NULL,
    "shopManagerId" TEXT,
    "shopCriteria" "ShopCriteria",
    "corridorStatus" BOOLEAN,
    "qgaAbove90" BOOLEAN,
    "qgaQuantity" INTEGER,
    "mmQoAbove90" BOOLEAN,
    "dsaAirtimeAchievementPercent" DECIMAL(6,2),
    "evdAbove100AndReconciled" BOOLEAN,
    "mpesaTargetAndReconciled" BOOLEAN,
    "mpesaFloatSold" DECIMAL(12,2),
    "baSite" BOOLEAN,
    "ebuTargetAchieved" BOOLEAN,
    "ebuRevenueMade" BOOLEAN,
    "ebuAverageTopupAbove500" BOOLEAN,
    "ebuFirstMonthLfRevenue" DECIMAL(12,2),
    "responsibleRemarks" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopManagerIncentiveInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopManagerIncentiveCalculation" (
    "id" TEXT NOT NULL,
    "incentivePeriodId" TEXT NOT NULL,
    "inputId" TEXT,
    "shopLocationId" TEXT NOT NULL,
    "shopManagerId" TEXT,
    "shopCriteria" "ShopCriteria",
    "qgaBonus" DECIMAL(12,2),
    "qgaSimCommission" DECIMAL(12,2),
    "evdBonus" DECIMAL(12,2),
    "mpesaCommission" DECIMAL(12,2),
    "baSiteBonus" DECIMAL(12,2),
    "dsaAchievementBonus" DECIMAL(12,2),
    "qoBonus" DECIMAL(12,2),
    "ebuActivationBonus" DECIMAL(12,2),
    "ebuRevenueShare" DECIMAL(12,2),
    "totalIncentive" DECIMAL(12,2),
    "calculationNote" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopManagerIncentiveCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayComponentAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payComponentId" TEXT NOT NULL,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayComponentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopManagerIncentiveInputConfig" (
    "id" TEXT NOT NULL,
    "inputCode" TEXT NOT NULL,
    "inputLabel" TEXT NOT NULL,
    "ownerDepartment" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "allowedValues" TEXT,
    "usedInComponent" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "blocksCalculation" BOOLEAN NOT NULL DEFAULT false,
    "blocksPayrollHandoff" BOOLEAN NOT NULL DEFAULT false,
    "minValue" DECIMAL(12,2),
    "maxValue" DECIMAL(12,2),
    "helpText" TEXT,
    "requiredWhenJson" TEXT,

    CONSTRAINT "ShopManagerIncentiveInputConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "dept_code_unique" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "loc_code_unique" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_profile_location_unique" ON "ShopProfile"("shopLocationId");

-- CreateIndex
CREATE INDEX "ShopCriteriaStatusHistory_shopLocationId_effectiveFrom_idx" ON "ShopCriteriaStatusHistory"("shopLocationId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ShopCriteriaStatusHistory_shopLocationId_effectiveTo_idx" ON "ShopCriteriaStatusHistory"("shopLocationId", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "emp_employee_id_unique" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "emp_email_unique" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_employmentStatus_idx" ON "Employee"("employmentStatus");

-- CreateIndex
CREATE INDEX "Employee_currentRole_idx" ON "Employee"("currentRole");

-- CreateIndex
CREATE INDEX "Employee_currentDepartmentId_idx" ON "Employee"("currentDepartmentId");

-- CreateIndex
CREATE INDEX "Employee_directManagerId_idx" ON "Employee"("directManagerId");

-- CreateIndex
CREATE INDEX "Employee_accountingReportingManagerId_idx" ON "Employee"("accountingReportingManagerId");

-- CreateIndex
CREATE INDEX "Employee_employeeCategory_idx" ON "Employee"("employeeCategory");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_employeeId_endDate_idx" ON "EmployeeAssignment"("employeeId", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_employeeId_isActive_idx" ON "EmployeeAssignment"("employeeId", "isActive");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_employeeId_effectiveDate_idx" ON "EmployeeStatusHistory"("employeeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklist_employeeId_key" ON "OnboardingChecklist"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklistItem_checklistId_key_key" ON "OnboardingChecklistItem"("checklistId", "key");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_documentType_idx" ON "EmployeeDocument"("employeeId", "documentType");

-- CreateIndex
CREATE INDEX "EmployeeDocument_visibilityLevel_isActive_idx" ON "EmployeeDocument"("visibilityLevel", "isActive");

-- CreateIndex
CREATE INDEX "LeaveRecord_employeeId_startDate_idx" ON "LeaveRecord"("employeeId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveType_periodStart_periodEnd_key" ON "LeaveBalance"("employeeId", "leaveType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EmployeeEvaluation_employeeId_status_idx" ON "EmployeeEvaluation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeEvaluation_evaluatorId_idx" ON "EmployeeEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "Achievement_employeeId_approvalStatus_idx" ON "Achievement"("employeeId", "approvalStatus");

-- CreateIndex
CREATE INDEX "DisciplinaryRecord_employeeId_status_idx" ON "DisciplinaryRecord"("employeeId", "status");

-- CreateIndex
CREATE INDEX "TerminationCase_employeeId_status_idx" ON "TerminationCase"("employeeId", "status");

-- CreateIndex
CREATE INDEX "TransferRequest_employeeId_status_idx" ON "TransferRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "PromotionRequest_employeeId_status_idx" ON "PromotionRequest"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_workflowId_stepOrder_key" ON "ApprovalStep"("workflowId", "stepOrder");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_isRead_idx" ON "Notification"("recipientUserId", "isRead");

-- CreateIndex
CREATE INDEX "EmployeeSalary_employeeId_effectiveDate_idx" ON "EmployeeSalary"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SalaryReview_employeeId_status_idx" ON "SalaryReview"("employeeId", "status");

-- CreateIndex
CREATE INDEX "CommissionCalculation_employeeId_periodStart_periodEnd_idx" ON "CommissionCalculation"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PayrollRule_ruleType_isActive_idx" ON "PayrollRule"("ruleType", "isActive");

-- CreateIndex
CREATE INDEX "PayeTaxBracket_scheduleCode_idx" ON "PayeTaxBracket"("scheduleCode");

-- CreateIndex
CREATE INDEX "PayrollAttendanceInput_employeeId_payrollPeriodStart_payrol_idx" ON "PayrollAttendanceInput"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");

-- CreateIndex
CREATE INDEX "PayrollAllowance_employeeId_payrollPeriodStart_payrollPerio_idx" ON "PayrollAllowance"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");

-- CreateIndex
CREATE INDEX "PayrollDeduction_employeeId_payrollPeriodStart_payrollPerio_idx" ON "PayrollDeduction"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");

-- CreateIndex
CREATE INDEX "PayrollPreparationBatch_payrollPeriodId_idx" ON "PayrollPreparationBatch"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollPreparationBatch_status_idx" ON "PayrollPreparationBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPreparationBatch_payrollPeriodId_version_key" ON "PayrollPreparationBatch"("payrollPeriodId", "version");

-- CreateIndex
CREATE INDEX "PayrollPreparationRow_payrollPeriodId_idx" ON "PayrollPreparationRow"("payrollPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPreparationRow_batchId_employeeId_key" ON "PayrollPreparationRow"("batchId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollCalculationLine_batchId_idx" ON "PayrollCalculationLine"("batchId");

-- CreateIndex
CREATE INDEX "PayrollCalculationLine_rowId_idx" ON "PayrollCalculationLine"("rowId");

-- CreateIndex
CREATE INDEX "PayrollCalculationLine_employeeId_idx" ON "PayrollCalculationLine"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollCalculationLine_payrollPeriodId_idx" ON "PayrollCalculationLine"("payrollPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriodLock_payrollPeriodStart_payrollPeriodEnd_key" ON "PayrollPeriodLock"("payrollPeriodStart", "payrollPeriodEnd");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_employeeId_payrollPeriodStart_payrollPeri_idx" ON "PayrollAdjustment"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "KpiMetric_name_key" ON "KpiMetric"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_attendanceDate_key" ON "AttendanceRecord"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "DataQualityIssue_severity_status_idx" ON "DataQualityIssue"("severity", "status");

-- CreateIndex
CREATE INDEX "EmployeeProfileChangeRequest_employeeId_status_idx" ON "EmployeeProfileChangeRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "SalaryRuleApprovalRequest_ruleId_status_idx" ON "SalaryRuleApprovalRequest"("ruleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseControlChecklist_section_item_key" ON "PhaseControlChecklist"("section", "item");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollProfile_employeeId_key" ON "EmployeePayrollProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayComponent_code_key" ON "PayComponent"("code");

-- CreateIndex
CREATE INDEX "PayRule_componentId_status_idx" ON "PayRule"("componentId", "status");

-- CreateIndex
CREATE INDEX "PayRule_role_employeeCategory_status_idx" ON "PayRule"("role", "employeeCategory", "status");

-- CreateIndex
CREATE INDEX "PayRule_effectiveFrom_effectiveTo_idx" ON "PayRule"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "ImportRow_sessionId_status_idx" ON "ImportRow"("sessionId", "status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_createdById_idx" ON "PayrollPeriod"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollInputType_code_key" ON "PayrollInputType"("code");

-- CreateIndex
CREATE INDEX "PayrollInputType_code_idx" ON "PayrollInputType"("code");

-- CreateIndex
CREATE INDEX "PayrollInputType_category_idx" ON "PayrollInputType"("category");

-- CreateIndex
CREATE INDEX "PayrollInputType_isActive_idx" ON "PayrollInputType"("isActive");

-- CreateIndex
CREATE INDEX "PayrollInputType_payComponentId_idx" ON "PayrollInputType"("payComponentId");

-- CreateIndex
CREATE INDEX "PayrollPeriodEmployee_payrollPeriodId_isSelected_idx" ON "PayrollPeriodEmployee"("payrollPeriodId", "isSelected");

-- CreateIndex
CREATE INDEX "PayrollPeriodEmployee_employeeId_idx" ON "PayrollPeriodEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriodEmployee_payrollPeriodId_employeeId_key" ON "PayrollPeriodEmployee"("payrollPeriodId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollInput_payrollPeriodId_employeeId_idx" ON "PayrollInput"("payrollPeriodId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollInput_payrollPeriodId_inputTypeId_idx" ON "PayrollInput"("payrollPeriodId", "inputTypeId");

-- CreateIndex
CREATE INDEX "PayrollInput_payrollPeriodId_status_idx" ON "PayrollInput"("payrollPeriodId", "status");

-- CreateIndex
CREATE INDEX "PayrollInput_employeeId_idx" ON "PayrollInput"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollInput_payrollPeriodId_employeeId_inputTypeId_key" ON "PayrollInput"("payrollPeriodId", "employeeId", "inputTypeId");

-- CreateIndex
CREATE INDEX "PayrollInputRequirement_inputTypeId_isActive_idx" ON "PayrollInputRequirement"("inputTypeId", "isActive");

-- CreateIndex
CREATE INDEX "PayrollInputRequirement_employeeCategory_role_idx" ON "PayrollInputRequirement"("employeeCategory", "role");

-- CreateIndex
CREATE INDEX "PayrollInputWaiver_payrollPeriodId_idx" ON "PayrollInputWaiver"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollInputWaiver_employeeId_idx" ON "PayrollInputWaiver"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollInputWaiver_payrollPeriodId_employeeId_inputTypeId_key" ON "PayrollInputWaiver"("payrollPeriodId", "employeeId", "inputTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopManagerIncentivePeriod_payrollPeriodId_key" ON "ShopManagerIncentivePeriod"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "ShopManagerIncentivePeriod_payrollPeriodId_idx" ON "ShopManagerIncentivePeriod"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "ShopManagerIncentivePeriod_status_idx" ON "ShopManagerIncentivePeriod"("status");

-- CreateIndex
CREATE INDEX "ShopManagerIncentivePeriod_month_year_idx" ON "ShopManagerIncentivePeriod"("month", "year");

-- CreateIndex
CREATE INDEX "ShopManagerIncentiveInput_incentivePeriodId_idx" ON "ShopManagerIncentiveInput"("incentivePeriodId");

-- CreateIndex
CREATE INDEX "ShopManagerIncentiveInput_shopLocationId_idx" ON "ShopManagerIncentiveInput"("shopLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopManagerIncentiveInput_incentivePeriodId_shopLocationId_key" ON "ShopManagerIncentiveInput"("incentivePeriodId", "shopLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopManagerIncentiveCalculation_inputId_key" ON "ShopManagerIncentiveCalculation"("inputId");

-- CreateIndex
CREATE INDEX "ShopManagerIncentiveCalculation_incentivePeriodId_idx" ON "ShopManagerIncentiveCalculation"("incentivePeriodId");

-- CreateIndex
CREATE INDEX "ShopManagerIncentiveCalculation_shopLocationId_idx" ON "ShopManagerIncentiveCalculation"("shopLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopManagerIncentiveCalculation_incentivePeriodId_shopLocat_key" ON "ShopManagerIncentiveCalculation"("incentivePeriodId", "shopLocationId");

-- CreateIndex
CREATE INDEX "EmployeePayComponentAssignment_employeeId_payComponentId_ef_idx" ON "EmployeePayComponentAssignment"("employeeId", "payComponentId", "effectiveTo");

-- CreateIndex
CREATE INDEX "EmployeePayComponentAssignment_employeeId_isActive_idx" ON "EmployeePayComponentAssignment"("employeeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayComponentAssignment_employeeId_payComponentId_ef_key" ON "EmployeePayComponentAssignment"("employeeId", "payComponentId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ShopManagerIncentiveInputConfig_inputCode_key" ON "ShopManagerIncentiveInputConfig"("inputCode");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProfile" ADD CONSTRAINT "ShopProfile_shopLocationId_fkey" FOREIGN KEY ("shopLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProfile" ADD CONSTRAINT "ShopProfile_defaultShopManagerId_fkey" FOREIGN KEY ("defaultShopManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProfile" ADD CONSTRAINT "ShopProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProfile" ADD CONSTRAINT "ShopProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCriteriaStatusHistory" ADD CONSTRAINT "ShopCriteriaStatusHistory_shopLocationId_fkey" FOREIGN KEY ("shopLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCriteriaStatusHistory" ADD CONSTRAINT "ShopCriteriaStatusHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCriteriaStatusHistory" ADD CONSTRAINT "ShopCriteriaStatusHistory_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_directManagerId_fkey" FOREIGN KEY ("directManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_accountingReportingManagerId_fkey" FOREIGN KEY ("accountingReportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRecord" ADD CONSTRAINT "LeaveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEvaluation" ADD CONSTRAINT "EmployeeEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryRecord" ADD CONSTRAINT "DisciplinaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminationCase" ADD CONSTRAINT "TerminationCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRequest" ADD CONSTRAINT "PromotionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryReview" ADD CONSTRAINT "SalaryReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCalculation" ADD CONSTRAINT "CommissionCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCalculation" ADD CONSTRAINT "CommissionCalculation_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAttendanceInput" ADD CONSTRAINT "PayrollAttendanceInput_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAllowance" ADD CONSTRAINT "PayrollAllowance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPreparationBatch" ADD CONSTRAINT "PayrollPreparationBatch_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPreparationRow" ADD CONSTRAINT "PayrollPreparationRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollPreparationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPreparationRow" ADD CONSTRAINT "PayrollPreparationRow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCalculationLine" ADD CONSTRAINT "PayrollCalculationLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollPreparationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCalculationLine" ADD CONSTRAINT "PayrollCalculationLine_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "PayrollPreparationRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCalculationLine" ADD CONSTRAINT "PayrollCalculationLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfileChangeRequest" ADD CONSTRAINT "EmployeeProfileChangeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRuleApprovalRequest" ADD CONSTRAINT "SalaryRuleApprovalRequest_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PayRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollProfile" ADD CONSTRAINT "EmployeePayrollProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayComponent" ADD CONSTRAINT "PayComponent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayComponent" ADD CONSTRAINT "PayComponent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRule" ADD CONSTRAINT "PayRule_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRule" ADD CONSTRAINT "PayRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRule" ADD CONSTRAINT "PayRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputType" ADD CONSTRAINT "PayrollInputType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputType" ADD CONSTRAINT "PayrollInputType_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputType" ADD CONSTRAINT "PayrollInputType_payComponentId_fkey" FOREIGN KEY ("payComponentId") REFERENCES "PayComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodEmployee" ADD CONSTRAINT "PayrollPeriodEmployee_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodEmployee" ADD CONSTRAINT "PayrollPeriodEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodEmployee" ADD CONSTRAINT "PayrollPeriodEmployee_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriodEmployee" ADD CONSTRAINT "PayrollPeriodEmployee_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_inputTypeId_fkey" FOREIGN KEY ("inputTypeId") REFERENCES "PayrollInputType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputRequirement" ADD CONSTRAINT "PayrollInputRequirement_inputTypeId_fkey" FOREIGN KEY ("inputTypeId") REFERENCES "PayrollInputType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputRequirement" ADD CONSTRAINT "PayrollInputRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputRequirement" ADD CONSTRAINT "PayrollInputRequirement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputWaiver" ADD CONSTRAINT "PayrollInputWaiver_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputWaiver" ADD CONSTRAINT "PayrollInputWaiver_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputWaiver" ADD CONSTRAINT "PayrollInputWaiver_inputTypeId_fkey" FOREIGN KEY ("inputTypeId") REFERENCES "PayrollInputType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInputWaiver" ADD CONSTRAINT "PayrollInputWaiver_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentivePeriod" ADD CONSTRAINT "ShopManagerIncentivePeriod_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentivePeriod" ADD CONSTRAINT "ShopManagerIncentivePeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveInput" ADD CONSTRAINT "ShopManagerIncentiveInput_incentivePeriodId_fkey" FOREIGN KEY ("incentivePeriodId") REFERENCES "ShopManagerIncentivePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveInput" ADD CONSTRAINT "ShopManagerIncentiveInput_shopLocationId_fkey" FOREIGN KEY ("shopLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveInput" ADD CONSTRAINT "ShopManagerIncentiveInput_shopManagerId_fkey" FOREIGN KEY ("shopManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveInput" ADD CONSTRAINT "ShopManagerIncentiveInput_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveInput" ADD CONSTRAINT "ShopManagerIncentiveInput_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveCalculation" ADD CONSTRAINT "ShopManagerIncentiveCalculation_incentivePeriodId_fkey" FOREIGN KEY ("incentivePeriodId") REFERENCES "ShopManagerIncentivePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveCalculation" ADD CONSTRAINT "ShopManagerIncentiveCalculation_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "ShopManagerIncentiveInput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveCalculation" ADD CONSTRAINT "ShopManagerIncentiveCalculation_shopLocationId_fkey" FOREIGN KEY ("shopLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopManagerIncentiveCalculation" ADD CONSTRAINT "ShopManagerIncentiveCalculation_shopManagerId_fkey" FOREIGN KEY ("shopManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponentAssignment" ADD CONSTRAINT "EmployeePayComponentAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayComponentAssignment" ADD CONSTRAINT "EmployeePayComponentAssignment_payComponentId_fkey" FOREIGN KEY ("payComponentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
