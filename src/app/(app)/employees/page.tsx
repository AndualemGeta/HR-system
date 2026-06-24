import { EmployeesClient } from "@/app/(app)/employees/employees-client";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function EmployeesPage() {
  const principal = await requirePagePermission("employee.view");

  return <EmployeesClient canCreateEmployee={hasPermission(principal, "employee.create")} />;
}
