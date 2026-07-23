-- CreateEnum
CREATE TYPE "PayrollGroup" AS ENUM ('HO_AA_SHOP', 'DSA', 'EBU_DEPARTMENT', 'ALELETU', 'CHACHA', 'LEGETAFO', 'HMARIAM', 'SIRTI', 'MENDIDA', 'SENDAFA', 'SHENO');

-- AlterTable
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN     "payrollGroup" "PayrollGroup";

-- AlterTable
ALTER TABLE "MvpPayrollRow" ADD COLUMN     "payrollGroup" "PayrollGroup";
