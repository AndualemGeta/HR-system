import { notFound } from "next/navigation";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canViewLifecycleRecord } from "@/lib/phase3-access";
import { employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function DisciplinaryDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const principal = await requirePagePermission("disciplinary.view");
  const { recordId } = await params;
  const record = await prisma.disciplinaryRecord.findUnique({ where: { id: recordId }, include: { employee: true } });
  if (!record) notFound();
  if (!canViewLifecycleRecord(principal, employeeToScope(record.employee), "disciplinary.view")) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "DisciplinaryRecord", entityId: record.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { timestamp: "desc" },
    take: 12
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>{record.employee.fullName}</h2>
          <p>
            {record.incidentType} / {record.incidentDate.toLocaleDateString()}
          </p>
        </div>
        <Badge tone={record.status === "APPROVED" ? "green" : record.status === "REJECTED" ? "red" : "amber"}>
          {record.status}
        </Badge>
      </header>

      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h3>Record Detail</h3>
            <span>{record.warningLevel ?? "No warning level"}</span>
          </div>
          <ul className="timeline">
            <li>
              <strong>Description</strong>
              <span>{record.description}</span>
            </li>
            <li>
              <strong>Action taken</strong>
              <span>{record.actionTaken ?? "No action recorded"}</span>
            </li>
            <li>
              <strong>Follow-up</strong>
              <span>{record.followUpDate?.toLocaleDateString() ?? "No follow-up date"}</span>
            </li>
            <li>
              <strong>Review / approval</strong>
              <span>{record.reviewedById ?? record.approvedById ?? "Pending"}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Actions</h3>
            <span>Permissioned</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {record.status === "DRAFT" && hasPermission(principal, "disciplinary.submit") && (
              <AsyncForm action={`/api/disciplinary/${record.id}`} method="PATCH" className="toolbar" submitLabel="Submit record">
                <input name="status" type="hidden" value="SUBMITTED" />
              </AsyncForm>
            )}
            {record.status === "SUBMITTED" && hasPermission(principal, "disciplinary.review") && (
              <AsyncForm action={`/api/disciplinary/${record.id}`} method="PATCH" className="toolbar" submitLabel="Mark under review">
                <input name="status" type="hidden" value="UNDER_REVIEW" />
              </AsyncForm>
            )}
            {["SUBMITTED", "UNDER_REVIEW"].includes(record.status) && hasPermission(principal, "disciplinary.approve") && (
              <>
                <AsyncForm action={`/api/disciplinary/${record.id}`} method="PATCH" className="toolbar" submitLabel="Approve">
                  <input name="status" type="hidden" value="APPROVED" />
                </AsyncForm>
                <AsyncForm action={`/api/disciplinary/${record.id}`} method="PATCH" className="toolbar" submitLabel="Reject">
                  <input name="status" type="hidden" value="REJECTED" />
                </AsyncForm>
              </>
            )}
            {record.status === "APPROVED" && hasPermission(principal, "disciplinary.close") && (
              <AsyncForm action={`/api/disciplinary/${record.id}`} method="PATCH" className="toolbar" submitLabel="Close">
                <input name="status" type="hidden" value="CLOSED" />
              </AsyncForm>
            )}
          </div>
        </section>
      </div>

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
