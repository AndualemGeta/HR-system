import { notFound } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { canUpdateSalary, hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function PromotionDetailPage({ params }: { params: Promise<{ promotionId: string }> }) {
  const principal = await requirePagePermission("promotion.view");
  const { promotionId } = await params;
  const promotion = await prisma.promotionRequest.findUnique({ where: { id: promotionId }, include: { employee: true } });
  if (!promotion) notFound();
  if (!canViewLifecycleRecord(principal, employeeToScope(promotion.employee), "promotion.view")) notFound();

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{promotion.employee.fullName}</h2>
          <p>{promotion.reason}</p>
        </div>
        <Badge tone={promotion.status === "COMPLETED" ? "green" : promotion.status === "REJECTED" ? "red" : "amber"}>
          {promotion.status}
        </Badge>
      </header>
      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h3>Requested Promotion</h3>
            <span>{promotion.effectiveDate?.toLocaleDateString() ?? "No effective date"}</span>
          </div>
          <div className="matrix">
            <div className="mini-card"><span>Current role</span><strong>{promotion.currentRole}</strong></div>
            <div className="mini-card"><span>Proposed role</span><strong>{promotion.proposedRole ?? "No change"}</strong></div>
            <div className="mini-card"><span>Current level</span><strong>{promotion.currentLevel}</strong></div>
            <div className="mini-card"><span>Proposed level</span><strong>{promotion.proposedLevel ?? "No change"}</strong></div>
            <div className="mini-card"><span>Proposed salary</span><strong>{canUpdateSalary(principal) ? promotion.proposedSalary?.toString() ?? "None" : "Restricted"}</strong></div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h3>Actions</h3>
            <span>Permissioned</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {promotion.status === "DRAFT" && hasPermission(principal, "promotion.submit") && (
              <AsyncForm action={`/api/promotions/${promotion.id}`} method="PATCH" className="toolbar" submitLabel="Submit">
                <input name="status" type="hidden" value="SUBMITTED" />
              </AsyncForm>
            )}
            {promotion.status === "SUBMITTED" && hasPermission(principal, "promotion.approve") && (
              <AsyncForm action={`/api/promotions/${promotion.id}`} method="PATCH" className="toolbar" submitLabel="Approve">
                <input name="status" type="hidden" value="APPROVED" />
              </AsyncForm>
            )}
            {promotion.status === "APPROVED" && hasPermission(principal, "promotion.complete") && (
              <AsyncForm action={`/api/promotions/${promotion.id}`} method="PATCH" className="toolbar" submitLabel="Complete promotion">
                <input name="status" type="hidden" value="COMPLETED" />
              </AsyncForm>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
