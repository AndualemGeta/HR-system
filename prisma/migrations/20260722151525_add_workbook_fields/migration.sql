-- AlterTable
ALTER TABLE "MvpPayrollRow" ADD COLUMN     "employerPension" DECIMAL(12,2),
ADD COLUMN     "monthlySalary" DECIMAL(12,2),
ADD COLUMN     "taxableIncome" DECIMAL(12,2),
ADD COLUMN     "workingDays" DECIMAL(6,2);
