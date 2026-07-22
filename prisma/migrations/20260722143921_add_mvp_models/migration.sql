-- CreateEnum
CREATE TYPE "MvpPayrollPeriodStatus" AS ENUM ('DRAFT', 'READY', 'LOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MvpPayrollRowValidationStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "MvpPayrollPeriod" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "periodName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "status" "MvpPayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "readyById" TEXT,
    "readyAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "reopenedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MvpPayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpPayrollRow" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT,
    "location" TEXT,
    "basicSalary" DECIMAL(12,2),
    "allowance" DECIMAL(12,2),
    "overtime" DECIMAL(12,2),
    "incentive" DECIMAL(12,2),
    "commission" DECIMAL(12,2),
    "grossSalary" DECIMAL(12,2),
    "employeePension" DECIMAL(12,2),
    "incomeTax" DECIMAL(12,2),
    "otherDeduction" DECIMAL(12,2),
    "totalDeduction" DECIMAL(12,2),
    "netSalary" DECIMAL(12,2),
    "paymentMethod" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "mpesaAccount" TEXT,
    "notes" TEXT,
    "validationStatus" "MvpPayrollRowValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationMessages" JSONB,
    "snapshotJson" JSONB,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MvpPayrollRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpPayrollExport" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'XLSX',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(14,2),
    "totalDeductions" DECIMAL(14,2),
    "totalNet" DECIMAL(14,2),
    "checksum" TEXT,
    "templateVersion" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MvpPayrollExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MvpPayrollPeriod_status_idx" ON "MvpPayrollPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MvpPayrollPeriod_month_year_key" ON "MvpPayrollPeriod"("month", "year");

-- CreateIndex
CREATE INDEX "MvpPayrollRow_payrollPeriodId_idx" ON "MvpPayrollRow"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "MvpPayrollRow_employeeId_idx" ON "MvpPayrollRow"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "MvpPayrollRow_payrollPeriodId_employeeId_key" ON "MvpPayrollRow"("payrollPeriodId", "employeeId");

-- CreateIndex
CREATE INDEX "MvpPayrollExport_payrollPeriodId_idx" ON "MvpPayrollExport"("payrollPeriodId");

-- AddForeignKey
ALTER TABLE "MvpPayrollRow" ADD CONSTRAINT "MvpPayrollRow_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "MvpPayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpPayrollRow" ADD CONSTRAINT "MvpPayrollRow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpPayrollExport" ADD CONSTRAINT "MvpPayrollExport_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "MvpPayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
