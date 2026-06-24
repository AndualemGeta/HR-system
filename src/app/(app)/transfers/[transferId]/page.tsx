import { notFound } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function TransferDetailPage({ params }: { params: Promise<{ transferId: string }> }) {
  const principal = await requirePagePermission("transfer.view");
  const { transferId } = await params;
  const transfer = await prisma.transferRequest.findUnique({ where: { id: transferId }, include: { employee: true } });
  if (!transfer) notFound();
  if (!canViewLifecycleRecord(principal, employeeToScope(transfer.employee), "transfer.view")) notFound();

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{transfer.employee.fullName}</h2>
          <p>{transfer.reason}</p>
        </div>
        <Badge tone={transfer.status === "COMPLETED" ? "green" : transfer.status === "REJECTED" ? "red" : "amber"}>
          {transfer.status}
        </Badge>
      </header>
      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h3>Requested Assignment</h3>
            <span>{transfer.effectiveDate?.toLocaleDateString() ?? "No effective date"}</span>
          </div>
          <div className="matrix">
            <div className="mini-card"><span>Role</span><strong>{transfer.requestedRole ?? "No change"}</strong></div>
            <div className="mini-card"><span>Level</span><strong>{transfer.requestedLevel ?? "No change"}</strong></div>
            <div className="mini-card"><span>Department</span><strong>{transfer.requestedDepartmentId ?? "No change"}</strong></div>
            <div className="mini-card"><span>Shop</span><strong>{transfer.requestedShopId ?? "No change"}</strong></div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h3>Actions</h3>
            <span>Permissioned</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {transfer.status === "DRAFT" && hasPermission(principal, "transfer.submit") && (
              <AsyncForm action={`/api/transfers/${transfer.id}`} method="PATCH" className="toolbar" submitLabel="Submit">
                <input name="status" type="hidden" value="SUBMITTED" />
              </AsyncForm>
            )}
            {transfer.status === "SUBMITTED" && hasPermission(principal, "transfer.approve") && (
              <AsyncForm action={`/api/transfers/${transfer.id}`} method="PATCH" className="toolbar" submitLabel="Approve">
                <input name="status" type="hidden" value="APPROVED" />
              </AsyncForm>
            )}
            {transfer.status === "APPROVED" && hasPermission(principal, "transfer.complete") && (
              <AsyncForm action={`/api/transfers/${transfer.id}`} method="PATCH" className="toolbar" submitLabel="Complete transfer">
                <input name="status" type="hidden" value="COMPLETED" />
              </AsyncForm>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
