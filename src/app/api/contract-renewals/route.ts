import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("employee.view");
  if (isApiError(principal)) return principal;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const employeesWithContracts = await prisma.employee.findMany({
    where: {
      employmentType: "CONTRACT",
      employmentStatus: { in: ["ACTIVE", "ON_PROBATION", "ONBOARDING"] },
      documents: {
        some: {
          documentType: "CONTRACT",
          isActive: true
        }
      }
    },
    include: {
      documents: {
        where: { documentType: "CONTRACT", isActive: true },
        select: { id: true, uploadedAt: true, notes: true }
      },
      currentDepartment: { select: { name: true } },
      reminders: {
        where: { reminderType: "CONTRACT_EXPIRY", status: "OPEN" },
        select: { id: true, dueDate: true }
      }
    },
    orderBy: { hireDate: "asc" }
  });

  return NextResponse.json({ employees: employeesWithContracts, thresholdDate: thirtyDaysFromNow });
}
