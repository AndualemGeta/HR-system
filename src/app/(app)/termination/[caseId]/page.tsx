import { notFound } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canUpdateFinalPayment, canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function TerminationDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const principal = await requirePagePermission("termination.view");
  const { caseId } = await params;
  const termination = await prisma.terminationCase.findUnique({
    where: { id: caseId },
    include: { employee: true, exitItems: { orderBy: { key: "asc" } } }
  });
  if (!termination) notFound();
  if (!canViewLifecycleRecord(principal, employeeToScope(termination.employee), "termination.view")) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "TerminationCase", entityId: termination.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { timestamp: "desc" },
    take: 12
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{termination.employee.fullName}</h2>
          <p>
            {termination.terminationType} / last working date{" "}
            {termination.lastWorkingDate?.toLocaleDateString() ?? "not set"}
          </p>
        </div>
        <Badge tone={termination.status === "EXIT_COMPLETED" ? "green" : termination.status === "REJECTED" ? "red" : "amber"}>
          {termination.status}
        </Badge>
      </header>

      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h3>Exit Detail</h3>
            <span>{termination.approvalStatus}</span>
          </div>
          <ul className="timeline">
            <li>
              <strong>Reason</strong>
              <span>{termination.reason}</span>
            </li>
            <li>
              <strong>Final payment</strong>
              <span>{termination.finalPaymentStatus}</span>
            </li>
            <li>
              <strong>Clearance</strong>
              <span>{termination.clearanceStatus}</span>
            </li>
            <li>
              <strong>Exit interview</strong>
              <span>{termination.exitInterviewStatus}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Actions</h3>
            <span>Permissioned</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {termination.status === "DRAFT" && hasPermission(principal, "termination.submit") && (
              <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="toolbar" submitLabel="Submit case">
                <input name="status" type="hidden" value="SUBMITTED" />
              </AsyncForm>
            )}
            {termination.status === "SUBMITTED" && hasPermission(principal, "termination.review") && (
              <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="toolbar" submitLabel="Mark under review">
                <input name="status" type="hidden" value="UNDER_REVIEW" />
              </AsyncForm>
            )}
            {["SUBMITTED", "UNDER_REVIEW"].includes(termination.status) && hasPermission(principal, "termination.approve") && (
              <>
                <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="toolbar" submitLabel="Approve">
                  <input name="status" type="hidden" value="APPROVED" />
                </AsyncForm>
                <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="toolbar" submitLabel="Reject">
                  <input name="status" type="hidden" value="REJECTED" />
                </AsyncForm>
              </>
            )}
            {termination.status === "APPROVED" && hasPermission(principal, "termination.complete_exit") && (
              <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="grid" submitLabel="Complete exit">
                <input name="status" type="hidden" value="EXIT_COMPLETED" />
                <label>
                  Override reason
                  <textarea className="textarea" name="overrideReason" />
                </label>
              </AsyncForm>
            )}
            {canUpdateFinalPayment(principal) && (
              <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="grid">
                <label>
                  Final payment
                  <select className="select" name="finalPaymentStatus" defaultValue={termination.finalPaymentStatus}>
                    {["NOT_STARTED", "PENDING_REVIEW", "APPROVED", "PAID", "ON_HOLD", "NOT_APPLICABLE"].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </AsyncForm>
            )}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Exit Checklist</h3>
          <span>{termination.exitItems.filter((item) => item.completed).length}/{termination.exitItems.length} completed</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {termination.exitItems.map((item) => (
            <div className="mini-card" key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.completed ? "Completed" : item.isRequired ? "Required" : "Optional"}</span>
              {hasPermission(principal, "termination.update") && (
                <AsyncForm action={`/api/termination/${termination.id}`} method="PATCH" className="toolbar" submitLabel={item.completed ? "Mark incomplete" : "Mark complete"}>
                  <input name="exitItemId" type="hidden" value={item.id} />
                  <input name="completed" type="hidden" value={item.completed ? "false" : "true"} />
                </AsyncForm>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Audit History</h3>
          <span>{auditLogs.length} events</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {auditLogs.map((log) => (
            <div className="mini-card" key={log.id}>
              <strong>{log.action}</strong>
              <span>
                {log.user?.email ?? "System"} - {log.timestamp.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
