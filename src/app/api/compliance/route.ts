import { NextResponse } from "next/server";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { getPhase4Compliance } from "@/lib/phase4-reports";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("compliance.view");
  if (isApiError(principal)) return principal;

  const compliance = await getPhase4Compliance(principal);
  await writeAuditLog({
    userId: principal.id,
    action: "COMPLIANCE_VIEW",
    entityType: "Phase4Compliance",
    newValue: {
      generatedFindings: compliance.generatedFindings.length,
      payrollBlockedRows: compliance.payrollBlockedRows
    }
  });

  return NextResponse.json({ compliance });
}
