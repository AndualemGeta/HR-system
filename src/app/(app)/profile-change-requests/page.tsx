import { ProfileChangeField } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireAppUser } from "@/lib/security/page-auth";

export default async function ProfileChangeRequestsPage() {
  const principal = await requireAppUser();
  const canViewAll = hasPermission(principal, "profile_change_request.view");
  const canSubmit = hasPermission(principal, "self_service.profile_update_request");
  const requests = await prisma.employeeProfileChangeRequest.findMany({
    where: canViewAll ? undefined : { employeeId: principal.employeeId ?? "__none__" },
    include: { employee: { select: { employeeId: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Profile Change Requests</h2>
          <p>Employee self-service requests for profile changes with HR review and audit history.</p>
        </div>
      </header>

      {canSubmit && (
        <AsyncForm action="/api/profile-change-requests">
          <div className="form-grid">
            <label>
              Field
              <select className="select" name="requestedField">
                {Object.values(ProfileChangeField).map((field) => <option key={field} value={field}>{field}</option>)}
              </select>
            </label>
            <label>
              New value
              <input className="field" name="newValue" required />
            </label>
            <label className="wide">
              Reason
              <textarea className="textarea" name="reason" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Requests</h3>
          <span>{requests.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {requests.map((request) => (
            <div className="mini-card" key={request.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{request.employee.employeeId} - {request.employee.fullName}</strong>
                <Badge tone={request.status === "APPROVED" ? "green" : request.status === "REJECTED" ? "red" : "amber"}>{request.status}</Badge>
              </div>
              <span>{request.requestedField}: {request.oldValue ?? "blank"} to {request.newValue}</span>
              {hasPermission(principal, "profile_change_request.approve") && request.status === "SUBMITTED" && (
                <div className="toolbar" style={{ marginTop: 8 }}>
                  <AsyncForm action={`/api/profile-change-requests/${request.id}`} method="PATCH" className="toolbar" submitLabel="Approve">
                    <input name="status" type="hidden" value="APPROVED" />
                  </AsyncForm>
                  <AsyncForm action={`/api/profile-change-requests/${request.id}`} method="PATCH" className="toolbar" submitLabel="Reject">
                    <input name="status" type="hidden" value="REJECTED" />
                  </AsyncForm>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
