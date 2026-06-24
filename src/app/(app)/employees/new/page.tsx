import { CreateEmployeeClient } from "@/app/(app)/employees/new/create-employee-client";
import { canUpdateSalary } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function CreateEmployeePage() {
  const principal = await requirePagePermission("employee.create");

  return <CreateEmployeeClient canEditSalary={canUpdateSalary(principal)} />;
}
