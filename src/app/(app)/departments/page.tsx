import { ModulePage } from "@/components/ui/module-page";
import { screenConfigs } from "@/lib/demo-data";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function DepartmentsPage() {
  await requirePagePermission("employee.view");
  return <ModulePage {...screenConfigs.departments} />;
}
