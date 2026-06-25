import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";
import { ContractRenewalsClient } from "./contract-renewals-client";

export default async function ContractRenewalsPage() {
  await requirePagePermission("employee.view");

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const employees = await prisma.employee.findMany({
    where: {
      employmentType: "CONTRACT",
      employmentStatus: { in: ["ACTIVE", "ON_PROBATION", "ONBOARDING"] }
    },
    include: {
      documents: {
        where: { documentType: "CONTRACT", isActive: true },
        select: { id: true, uploadedAt: true, notes: true }
      },
      currentDepartment: { select: { name: true } },
      reminders: {
        where: { reminderType: "CONTRACT_EXPIRY", status: "OPEN" },
        select: { id: true, dueDate: true, status: true }
      }
    },
    orderBy: { hireDate: "asc" }
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Contract Renewals</h2>
          <p>Track employees on fixed-term contracts and manage renewal reminders.</p>
        </div>
      </header>
      <ContractRenewalsClient employees={employees} thresholdDate={thirtyDaysFromNow} />
    </>
  );
}
