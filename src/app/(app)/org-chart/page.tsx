import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";
import { OrgChartTree } from "./org-chart-tree";
import type { DeptNode, OrgNode } from "./types";

export default async function OrgChartPage() {
  await requirePagePermission("employee.view");

  const departments = await prisma.department.findMany({
    include: {
      head: { select: { id: true, employeeId: true, fullName: true, currentRole: true } },
      children: { include: { head: { select: { id: true, employeeId: true, fullName: true, currentRole: true } } } }
    },
    orderBy: { name: "asc" }
  });

  const orgUnits = await prisma.organizationUnit.findMany({
    include: {
      manager: { select: { id: true, employeeId: true, fullName: true, currentRole: true } },
      children: { include: { manager: { select: { id: true, employeeId: true, fullName: true, currentRole: true } } } }
    },
    where: { active: true, parentId: null },
    orderBy: { name: "asc" }
  });

  const employees = await prisma.employee.findMany({
    where: { employmentStatus: { in: ["ACTIVE", "ON_PROBATION"] } },
    select: {
      id: true, employeeId: true, fullName: true, currentRole: true,
      currentDepartmentId: true, directManagerId: true
    },
    orderBy: { fullName: "asc" }
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Organizational Chart</h2>
          <p>Company structure overview — departments, divisions, and reporting lines.</p>
        </div>
      </header>
      <OrgChartTree departments={departments as unknown as DeptNode[]} orgUnits={orgUnits as unknown as OrgNode[]} employees={employees} />
    </>
  );
}
