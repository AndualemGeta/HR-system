import { ShieldCheck } from "lucide-react";
import { ModulePage } from "@/components/ui/module-page";
import { Badge } from "@/components/ui/badge";
import { screenConfigs } from "@/lib/demo-data";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SalaryPage() {
  await requirePagePermission("salary.view");

  return (
    <ModulePage
      {...screenConfigs.salary}
      actions={
        <Badge tone="blue">
          <ShieldCheck size={16} aria-hidden="true" />
          Protected
        </Badge>
      }
    />
  );
}
