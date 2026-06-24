-- CreateEnum
CREATE TYPE "CompensationRecommendation" AS ENUM ('NO_CHANGE', 'SALARY_INCREASE_RECOMMENDED', 'SALARY_DECREASE_RECOMMENDED', 'BONUS_RECOMMENDED', 'COMMISSION_ADJUSTMENT_RECOMMENDED', 'PROMOTION_RECOMMENDED', 'PERFORMANCE_IMPROVEMENT_PLAN', 'OTHER');

CREATE TYPE "SalaryReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HR_REVIEW', 'FINANCE_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "CompensationReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PayrollRuleType" AS ENUM ('PAYE_TAX_BRACKET', 'PENSION_EMPLOYEE_RATE', 'PENSION_EMPLOYER_RATE', 'OVERTIME_SUNDAY_RATE', 'OVERTIME_HOLIDAY_RATE', 'OVERTIME_NIGHT_RATE', 'WORKING_DAYS_DEFAULT', 'COMMISSION_RULE', 'ALLOWANCE_RULE', 'DEDUCTION_RULE', 'PRORATION_RULE', 'OTHER');
CREATE TYPE "AllowanceType" AS ENUM ('KPI_ALLOWANCE', 'TRANSPORT_ALLOWANCE', 'HOUSING_ALLOWANCE', 'POSITION_ALLOWANCE', 'MEAL_ALLOWANCE', 'COMMUNICATION_ALLOWANCE', 'OTHER_ALLOWANCE');
CREATE TYPE "DeductionType" AS ENUM ('LOAN_DEDUCTION', 'ADVANCE_DEDUCTION', 'ABSENCE_DEDUCTION', 'DAMAGE_DEDUCTION', 'PENALTY_DEDUCTION', 'OTHER_DEDUCTION');
CREATE TYPE "CommissionCalculationType" AS ENUM ('FIXED_AMOUNT', 'PERCENT_OF_SALES', 'TIERED_PERCENT', 'TARGET_BASED', 'MANUAL', 'NONE');
CREATE TYPE "CommissionCalculationStatus" AS ENUM ('DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPORTED', 'CANCELLED');
CREATE TYPE "PayrollValidationIssueType" AS ENUM ('MISSING_EMPLOYEE_ID', 'MISSING_FULL_NAME', 'MISSING_EMPLOYMENT_TYPE', 'MISSING_SALARY', 'MISSING_SALARY_EFFECTIVE_DATE', 'MISSING_ATTENDANCE', 'UNAPPROVED_ATTENDANCE', 'ATTENDANCE_DAYS_MISMATCH', 'NEGATIVE_SALARY', 'NEGATIVE_ALLOWANCE', 'NEGATIVE_DEDUCTION', 'INVALID_OVERTIME', 'MISSING_PENSION_RULE', 'MISSING_PAYE_RULE', 'UNAPPROVED_COMMISSION', 'SALARY_REVIEW_PENDING', 'COMMISSION_REVIEW_PENDING', 'EMPLOYEE_NOT_ACTIVE', 'OTHER');

-- Extend existing enums. New values are not used in data statements in this migration.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EVALUATION_COMPENSATION_RECOMMENDATION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_SUBMISSION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_HR_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_FINANCE_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW_COMPLETION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_RULE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_RULE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_RULE_DEACTIVATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYE_BRACKET_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYE_BRACKET_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYE_BRACKET_DEACTIVATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PENSION_RULE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PENSION_RULE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PENSION_RULE_DEACTIVATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ATTENDANCE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ATTENDANCE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ATTENDANCE_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ATTENDANCE_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ALLOWANCE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ALLOWANCE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ALLOWANCE_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_ALLOWANCE_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_DEDUCTION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_DEDUCTION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_DEDUCTION_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_DEDUCTION_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_PLAN_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_PLAN_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_PLAN_DEACTIVATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_CALCULATION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_CALCULATION_RUN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_CALCULATION_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_CALCULATION_APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_CALCULATION_REJECTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_CALCULATION_EXPORT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMISSION_MANUAL_ADJUSTMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_CALCULATION_RUN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_VALIDATION_ISSUE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_VALIDATION_ISSUE_RESOLVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_VALIDATION_ISSUE_DISMISS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_IMPORT_PREVIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_IMPORT_COMMIT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMPENSATION_REPORT_VIEW';
ALTER TYPE "EvaluationType" ADD VALUE IF NOT EXISTS 'COMMISSION_REVIEW';
ALTER TYPE "EvaluationType" ADD VALUE IF NOT EXISTS 'SALARY_REVIEW';

-- Existing tables
ALTER TABLE "EmployeeEvaluation"
  ADD COLUMN "commissionReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "compensationRecommendation" "CompensationRecommendation" NOT NULL DEFAULT 'NO_CHANGE',
  ADD COLUMN "salaryReviewRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PayrollPreparationRow"
  ADD COLUMN "approvedAllowances" DECIMAL(12,2),
  ADD COLUMN "approvedCommission" DECIMAL(12,2),
  ADD COLUMN "approvedDeductions" DECIMAL(12,2),
  ADD COLUMN "daysPresent" DECIMAL(8,2),
  ADD COLUMN "employeePension" DECIMAL(12,2),
  ADD COLUMN "employerPension" DECIMAL(12,2),
  ADD COLUMN "employerTotalCost" DECIMAL(12,2),
  ADD COLUMN "grossSalary" DECIMAL(12,2),
  ADD COLUMN "manualAdjustments" DECIMAL(12,2),
  ADD COLUMN "netSalary" DECIMAL(12,2),
  ADD COLUMN "overtimeAmount" DECIMAL(12,2),
  ADD COLUMN "paidLeaveDays" DECIMAL(8,2),
  ADD COLUMN "payeTax" DECIMAL(12,2),
  ADD COLUMN "payrollBlockers" JSONB,
  ADD COLUMN "payrollCalculationBreakdown" JSONB,
  ADD COLUMN "payrollWarnings" JSONB,
  ADD COLUMN "proratedBasicSalary" DECIMAL(12,2),
  ADD COLUMN "taxableIncome" DECIMAL(12,2),
  ADD COLUMN "unpaidLeaveDays" DECIMAL(8,2),
  ADD COLUMN "workingDays" DECIMAL(8,2);

-- New tables
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
  "financeReviewStatus" "CompensationReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "hrReviewStatus" "CompensationReviewStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRule" (
  "id" TEXT NOT NULL,
  "ruleType" "PayrollRuleType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "value" TEXT,
  "rate" DECIMAL(10,4),
  "amount" DECIMAL(12,2),
  "effectiveStartDate" TIMESTAMP(3) NOT NULL,
  "effectiveEndDate" TIMESTAMP(3),
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayeTaxBracket" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minIncome" DECIMAL(12,2) NOT NULL,
  "maxIncome" DECIMAL(12,2),
  "taxRate" DECIMAL(10,4) NOT NULL,
  "deductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "effectiveStartDate" TIMESTAMP(3) NOT NULL,
  "effectiveEndDate" TIMESTAMP(3),
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayeTaxBracket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PensionRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "employeeRate" DECIMAL(10,4) NOT NULL,
  "employerRate" DECIMAL(10,4) NOT NULL,
  "applicableEmploymentType" "EmploymentType",
  "applicableRole" "EmployeeRole",
  "effectiveStartDate" TIMESTAMP(3) NOT NULL,
  "effectiveEndDate" TIMESTAMP(3),
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PensionRule_pkey" PRIMARY KEY ("id")
);

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
  "attendanceSource" TEXT,
  "uploadedById" TEXT,
  "approvedById" TEXT,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollAttendanceInput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollAllowance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
  "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
  "allowanceType" "AllowanceType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "taxableStatus" BOOLEAN NOT NULL DEFAULT true,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollAllowance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollDeduction" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "payrollPeriodStart" TIMESTAMP(3) NOT NULL,
  "payrollPeriodEnd" TIMESTAMP(3) NOT NULL,
  "deductionType" "DeductionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "preTaxStatus" BOOLEAN NOT NULL DEFAULT false,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "applicableRole" "EmployeeRole",
  "applicableDepartmentId" TEXT,
  "applicableDivisionId" TEXT,
  "employmentType" "EmploymentType",
  "calculationType" "CommissionCalculationType" NOT NULL DEFAULT 'NONE',
  "rate" DECIMAL(10,4),
  "thresholdAmount" DECIMAL(12,2),
  "fixedAmount" DECIMAL(12,2),
  "capAmount" DECIMAL(12,2),
  "activeStatus" BOOLEAN NOT NULL DEFAULT true,
  "effectiveStartDate" TIMESTAMP(3) NOT NULL,
  "effectiveEndDate" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionTier" (
  "id" TEXT NOT NULL,
  "commissionPlanId" TEXT NOT NULL,
  "minAmount" DECIMAL(12,2) NOT NULL,
  "maxAmount" DECIMAL(12,2),
  "rate" DECIMAL(10,4),
  "fixedAmount" DECIMAL(12,2),
  "tierOrder" INTEGER NOT NULL,
  CONSTRAINT "CommissionTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionCalculation" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "commissionPlanId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "salesAmount" DECIMAL(12,2),
  "targetAmount" DECIMAL(12,2),
  "achievementPercent" DECIMAL(8,2),
  "baseSalary" DECIMAL(12,2),
  "calculatedCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "manualAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "manualAdjustmentReason" TEXT,
  "finalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "calculationStatus" "CommissionCalculationStatus" NOT NULL DEFAULT 'DRAFT',
  "calculatedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "relatedEvaluationId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionCalculation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollValidationIssue" (
  "id" TEXT NOT NULL,
  "payrollBatchId" TEXT,
  "payrollRowId" TEXT,
  "employeeId" TEXT,
  "issueType" "PayrollValidationIssueType" NOT NULL,
  "severity" "DataQualitySeverity" NOT NULL,
  "fieldName" TEXT,
  "message" TEXT NOT NULL,
  "suggestedFix" TEXT,
  "status" "DataQualityStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PayrollValidationIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalaryReview_employeeId_status_idx" ON "SalaryReview"("employeeId", "status");
CREATE INDEX "SalaryReview_relatedEvaluationId_idx" ON "SalaryReview"("relatedEvaluationId");
CREATE INDEX "PayrollRule_ruleType_activeStatus_idx" ON "PayrollRule"("ruleType", "activeStatus");
CREATE INDEX "PayrollRule_effectiveStartDate_effectiveEndDate_idx" ON "PayrollRule"("effectiveStartDate", "effectiveEndDate");
CREATE INDEX "PayeTaxBracket_activeStatus_effectiveStartDate_effectiveEnd_idx" ON "PayeTaxBracket"("activeStatus", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "PensionRule_activeStatus_effectiveStartDate_effectiveEndDat_idx" ON "PensionRule"("activeStatus", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "PensionRule_applicableEmploymentType_applicableRole_idx" ON "PensionRule"("applicableEmploymentType", "applicableRole");
CREATE INDEX "PayrollAttendanceInput_employeeId_payrollPeriodStart_payrol_idx" ON "PayrollAttendanceInput"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");
CREATE INDEX "PayrollAttendanceInput_approvalStatus_idx" ON "PayrollAttendanceInput"("approvalStatus");
CREATE INDEX "PayrollAllowance_employeeId_payrollPeriodStart_payrollPerio_idx" ON "PayrollAllowance"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");
CREATE INDEX "PayrollAllowance_approvalStatus_idx" ON "PayrollAllowance"("approvalStatus");
CREATE INDEX "PayrollDeduction_employeeId_payrollPeriodStart_payrollPerio_idx" ON "PayrollDeduction"("employeeId", "payrollPeriodStart", "payrollPeriodEnd");
CREATE INDEX "PayrollDeduction_approvalStatus_idx" ON "PayrollDeduction"("approvalStatus");
CREATE INDEX "CommissionPlan_activeStatus_effectiveStartDate_effectiveEnd_idx" ON "CommissionPlan"("activeStatus", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "CommissionPlan_applicableRole_employmentType_idx" ON "CommissionPlan"("applicableRole", "employmentType");
CREATE INDEX "CommissionTier_commissionPlanId_tierOrder_idx" ON "CommissionTier"("commissionPlanId", "tierOrder");
CREATE INDEX "CommissionCalculation_employeeId_periodStart_periodEnd_idx" ON "CommissionCalculation"("employeeId", "periodStart", "periodEnd");
CREATE INDEX "CommissionCalculation_calculationStatus_idx" ON "CommissionCalculation"("calculationStatus");
CREATE INDEX "CommissionCalculation_relatedEvaluationId_idx" ON "CommissionCalculation"("relatedEvaluationId");
CREATE INDEX "PayrollValidationIssue_payrollBatchId_status_idx" ON "PayrollValidationIssue"("payrollBatchId", "status");
CREATE INDEX "PayrollValidationIssue_payrollRowId_idx" ON "PayrollValidationIssue"("payrollRowId");
CREATE INDEX "PayrollValidationIssue_employeeId_idx" ON "PayrollValidationIssue"("employeeId");
CREATE INDEX "PayrollValidationIssue_issueType_severity_idx" ON "PayrollValidationIssue"("issueType", "severity");

ALTER TABLE "SalaryReview" ADD CONSTRAINT "SalaryReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryReview" ADD CONSTRAINT "SalaryReview_relatedEvaluationId_fkey" FOREIGN KEY ("relatedEvaluationId") REFERENCES "EmployeeEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollAttendanceInput" ADD CONSTRAINT "PayrollAttendanceInput_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollAllowance" ADD CONSTRAINT "PayrollAllowance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionTier" ADD CONSTRAINT "CommissionTier_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionCalculation" ADD CONSTRAINT "CommissionCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionCalculation" ADD CONSTRAINT "CommissionCalculation_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionCalculation" ADD CONSTRAINT "CommissionCalculation_relatedEvaluationId_fkey" FOREIGN KEY ("relatedEvaluationId") REFERENCES "EmployeeEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollValidationIssue" ADD CONSTRAINT "PayrollValidationIssue_payrollBatchId_fkey" FOREIGN KEY ("payrollBatchId") REFERENCES "PayrollPreparationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollValidationIssue" ADD CONSTRAINT "PayrollValidationIssue_payrollRowId_fkey" FOREIGN KEY ("payrollRowId") REFERENCES "PayrollPreparationRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollValidationIssue" ADD CONSTRAINT "PayrollValidationIssue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
