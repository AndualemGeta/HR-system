-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK', 'MPESA', 'MANUAL', 'HOLD');

-- CreateEnum
CREATE TYPE "PayrollOutputPackageStatus" AS ENUM ('FINALIZED', 'REVIEWED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollPaymentBatchStatus" AS ENUM ('DRAFT', 'GENERATED', 'REVIEWED', 'APPROVED', 'RELEASED', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollPaymentInstructionStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'RETURNED', 'HELD');

-- CreateEnum
CREATE TYPE "PayrollStatutoryReportType" AS ENUM ('PAYE', 'EMPLOYEE_PENSION', 'EMPLOYER_PENSION', 'COMBINED_PENSION');

-- CreateEnum
CREATE TYPE "PayrollStatutoryReportStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'FILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX');

-- CreateTable
CREATE TABLE "PayrollOutputPackage" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "payrollPreparationBatchId" TEXT NOT NULL,
    "batchVersion" INTEGER NOT NULL,
    "status" "PayrollOutputPackageStatus" NOT NULL DEFAULT 'FINALIZED',
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(14,2),
    "deductionTotal" DECIMAL(14,2),
    "netPayTotal" DECIMAL(14,2),
    "employerCostTotal" DECIMAL(14,2),
    "employeePensionTotal" DECIMAL(14,2),
    "employerPensionTotal" DECIMAL(14,2),
    "payeTaxTotal" DECIMAL(14,2),
    "snapshotHash" TEXT,
    "cancellationReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollOutputPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipSnapshot" (
    "id" TEXT NOT NULL,
    "outputPackageId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "payrollPreparationBatchId" TEXT NOT NULL,
    "payrollPreparationRowId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "grossSalary" DECIMAL(14,2),
    "totalDeductions" DECIMAL(14,2),
    "netSalary" DECIMAL(14,2),
    "documentHash" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PayslipSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPaymentBatch" (
    "id" TEXT NOT NULL,
    "outputPackageId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "PayrollPaymentBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "batchReference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2),
    "generatedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "releasedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "PayrollPaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPaymentInstruction" (
    "id" TEXT NOT NULL,
    "paymentBatchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPreparationRowId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "beneficiaryName" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "mpesaAccount" TEXT,
    "amount" DECIMAL(14,2),
    "status" "PayrollPaymentInstructionStatus" NOT NULL DEFAULT 'PENDING',
    "externalReference" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "snapshotJson" TEXT,

    CONSTRAINT "PayrollPaymentInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollExportRecord" (
    "id" TEXT NOT NULL,
    "outputPackageId" TEXT NOT NULL,
    "paymentBatchId" TEXT,
    "exportType" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2),
    "checksum" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollStatutoryReport" (
    "id" TEXT NOT NULL,
    "outputPackageId" TEXT NOT NULL,
    "reportType" "PayrollStatutoryReportType" NOT NULL,
    "status" "PayrollStatutoryReportStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "employeeAmount" DECIMAL(14,2),
    "employerAmount" DECIMAL(14,2),
    "totalAmount" DECIMAL(14,2),
    "reportHash" TEXT,
    "generatedById" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "filedById" TEXT,
    "filingReference" TEXT,
    "filingDate" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollStatutoryReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollJournalBatch" (
    "id" TEXT NOT NULL,
    "outputPackageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalDebit" DECIMAL(16,2),
    "totalCredit" DECIMAL(16,2),
    "generatedById" TEXT,
    "approvedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollJournalBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollJournalLine" (
    "id" TEXT NOT NULL,
    "journalBatchId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT,
    "debitAmount" DECIMAL(14,2),
    "creditAmount" DECIMAL(14,2),
    "costCenter" TEXT,
    "department" TEXT,
    "region" TEXT,
    "shop" TEXT,
    "description" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,

    CONSTRAINT "PayrollJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentExportTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "hasHeader" BOOLEAN NOT NULL DEFAULT true,
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "amountFormat" TEXT NOT NULL DEFAULT '0.00',
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "columnConfigJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlAccountMapping" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPaymentRetryBatch" (
    "id" TEXT NOT NULL,
    "sourceInstructionId" TEXT NOT NULL,
    "retryPaymentBatchId" TEXT NOT NULL,
    "originalAmount" DECIMAL(14,2),
    "retryReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPaymentRetryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollOutputPackage_payrollPreparationBatchId_key" ON "PayrollOutputPackage"("payrollPreparationBatchId");

-- CreateIndex
CREATE INDEX "PayrollOutputPackage_payrollPeriodId_idx" ON "PayrollOutputPackage"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollOutputPackage_payrollPreparationBatchId_idx" ON "PayrollOutputPackage"("payrollPreparationBatchId");

-- CreateIndex
CREATE INDEX "PayrollOutputPackage_status_idx" ON "PayrollOutputPackage"("status");

-- CreateIndex
CREATE INDEX "PayslipSnapshot_employeeId_idx" ON "PayslipSnapshot"("employeeId");

-- CreateIndex
CREATE INDEX "PayslipSnapshot_outputPackageId_idx" ON "PayslipSnapshot"("outputPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipSnapshot_outputPackageId_payrollPreparationRowId_key" ON "PayslipSnapshot"("outputPackageId", "payrollPreparationRowId");

-- CreateIndex
CREATE INDEX "PayrollPaymentBatch_outputPackageId_idx" ON "PayrollPaymentBatch"("outputPackageId");

-- CreateIndex
CREATE INDEX "PayrollPaymentBatch_status_idx" ON "PayrollPaymentBatch"("status");

-- CreateIndex
CREATE INDEX "PayrollPaymentInstruction_status_idx" ON "PayrollPaymentInstruction"("status");

-- CreateIndex
CREATE INDEX "PayrollPaymentInstruction_externalReference_idx" ON "PayrollPaymentInstruction"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPaymentInstruction_paymentBatchId_employeeId_key" ON "PayrollPaymentInstruction"("paymentBatchId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollExportRecord_outputPackageId_idx" ON "PayrollExportRecord"("outputPackageId");

-- CreateIndex
CREATE INDEX "PayrollExportRecord_paymentBatchId_idx" ON "PayrollExportRecord"("paymentBatchId");

-- CreateIndex
CREATE INDEX "PayrollStatutoryReport_reportType_idx" ON "PayrollStatutoryReport"("reportType");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatutoryReport_outputPackageId_reportType_key" ON "PayrollStatutoryReport"("outputPackageId", "reportType");

-- CreateIndex
CREATE INDEX "PayrollJournalBatch_outputPackageId_idx" ON "PayrollJournalBatch"("outputPackageId");

-- CreateIndex
CREATE INDEX "PayrollJournalLine_journalBatchId_idx" ON "PayrollJournalLine"("journalBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentExportTemplate_code_key" ON "PaymentExportTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GlAccountMapping_category_key" ON "GlAccountMapping"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPaymentRetryBatch_sourceInstructionId_retryPaymentBa_key" ON "PayrollPaymentRetryBatch"("sourceInstructionId", "retryPaymentBatchId");

-- AddForeignKey
ALTER TABLE "PayslipSnapshot" ADD CONSTRAINT "PayslipSnapshot_outputPackageId_fkey" FOREIGN KEY ("outputPackageId") REFERENCES "PayrollOutputPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPaymentBatch" ADD CONSTRAINT "PayrollPaymentBatch_outputPackageId_fkey" FOREIGN KEY ("outputPackageId") REFERENCES "PayrollOutputPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPaymentInstruction" ADD CONSTRAINT "PayrollPaymentInstruction_paymentBatchId_fkey" FOREIGN KEY ("paymentBatchId") REFERENCES "PayrollPaymentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportRecord" ADD CONSTRAINT "PayrollExportRecord_outputPackageId_fkey" FOREIGN KEY ("outputPackageId") REFERENCES "PayrollOutputPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatutoryReport" ADD CONSTRAINT "PayrollStatutoryReport_outputPackageId_fkey" FOREIGN KEY ("outputPackageId") REFERENCES "PayrollOutputPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollJournalBatch" ADD CONSTRAINT "PayrollJournalBatch_outputPackageId_fkey" FOREIGN KEY ("outputPackageId") REFERENCES "PayrollOutputPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollJournalLine" ADD CONSTRAINT "PayrollJournalLine_journalBatchId_fkey" FOREIGN KEY ("journalBatchId") REFERENCES "PayrollJournalBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
