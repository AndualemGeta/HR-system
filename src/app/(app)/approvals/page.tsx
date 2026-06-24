import { ApprovalWorkflowType, SystemRole } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function ApprovalsPage() {
  const principal = await requirePagePermission("approval.view");
  const [workflows, requests] = await Promise.all([
    prisma.approvalWorkflow.findMany({ include: { steps: { orderBy: { stepOrder: "asc" } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.approvalRequest.findMany({
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        actions: { orderBy: { actionDate: "desc" } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Approval Routing</h2>
          <p>Configure approval flows, fallback governance, escalation timing, and submitted workflow requests.</p>
        </div>
      </header>

      {hasPermission(principal, "approval.configure") && (
        <AsyncForm action="/api/approvals/workflows">
          <div className="form-grid">
            <label>
              Name
              <input className="field" name="name" required />
            </label>
            <label>
              Workflow type
              <select className="select" name="workflowType">
                {Object.values(ApprovalWorkflowType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Approver role
              <select className="select" name="approverRole" defaultValue="HR_ADMIN">
                {Object.values(SystemRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Required permission
              <input className="field" name="requiredPermission" placeholder="termination.approve" />
            </label>
            <label>
              Fallback role
              <select className="select" name="fallbackApproverRole" defaultValue="">
                <option value="">None</option>
                {Object.values(SystemRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Escalation role
              <select className="select" name="escalationRole" defaultValue="">
                <option value="">None</option>
                {Object.values(SystemRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Escalation days
              <input className="field" name="escalationAfterDays" type="number" min="1" />
            </label>
          </div>
        </AsyncForm>
      )}

      <div className="grid two" style={{ marginTop: 16 }}>
        <section className="panel">
          <div className="panel-header">
            <h3>Approval Inbox</h3>
            <span>{requests.length} requests</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {requests.map((request) => (
              <div className="mini-card" key={request.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>
                    {request.workflow.workflowType} / {request.entityType}
                  </strong>
                  <Badge tone={request.status === "APPROVED" ? "green" : request.status === "REJECTED" ? "red" : "amber"}>
                    {request.status}
                  </Badge>
                </div>
                <span>Step {request.currentStep} / {request.entityId}</span>
                {hasPermission(principal, "approval.act") && ["SUBMITTED", "IN_PROGRESS"].includes(request.status) && (
                  <div className="toolbar" style={{ marginTop: 8 }}>
                    {(["APPROVE", "REJECT", "REQUEST_CHANGES"] as const).map((action) => (
                      <AsyncForm action={`/api/approvals/requests/${request.id}/actions`} className="toolbar" key={action}>
                        <input name="action" type="hidden" value={action} />
                        <span>{action}</span>
                      </AsyncForm>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Workflows</h3>
            <span>{workflows.length} configured</span>
          </div>
          <div className="grid" style={{ gap: 8 }}>
            {workflows.map((workflow) => (
              <div className="mini-card" key={workflow.id}>
                <strong>{workflow.name}</strong>
                <span>{workflow.workflowType} / {workflow.activeStatus ? "Active" : "Inactive"}</span>
                <span>{workflow.steps.length} steps</span>
                <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                  {workflow.steps.map((step) => (
                    <div key={step.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <strong>Step {step.stepOrder}</strong>
                      <span>
                        Approver {step.approverRole ?? step.approverUserId ?? "Unassigned"} / fallback{" "}
                        {step.fallbackApproverRole ?? step.fallbackApproverUserId ?? "None"} / escalation{" "}
                        {step.escalationRole ?? "None"} {step.escalationAfterDays ? `after ${step.escalationAfterDays} days` : ""}
                      </span>
                      {hasPermission(principal, "approval_governance.configure") && (
                        <AsyncForm action="/api/approvals/workflows" method="PATCH" className="grid" >
                          <input name="stepId" type="hidden" value={step.id} />
                          <div className="form-grid">
                            <label>
                              Fallback role
                              <select className="select" name="fallbackApproverRole" defaultValue={step.fallbackApproverRole ?? ""}>
                                <option value="">None</option>
                                {Object.values(SystemRole).map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Escalation role
                              <select className="select" name="escalationRole" defaultValue={step.escalationRole ?? ""}>
                                <option value="">None</option>
                                {Object.values(SystemRole).map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Escalation days
                              <input className="field" name="escalationAfterDays" type="number" min="1" defaultValue={step.escalationAfterDays ?? ""} />
                            </label>
                            <label>
                              Prevent self approval
                              <select className="select" name="preventSelfApproval" defaultValue={String(step.preventSelfApproval)}>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </label>
                            <label>
                              Reject comments
                              <select className="select" name="requireCommentsOnReject" defaultValue={String(step.requireCommentsOnReject)}>
                                <option value="true">Required</option>
                                <option value="false">Optional</option>
                              </select>
                            </label>
                            <label>
                              Change comments
                              <select className="select" name="requireCommentsOnChange" defaultValue={String(step.requireCommentsOnChange)}>
                                <option value="true">Required</option>
                                <option value="false">Optional</option>
                              </select>
                            </label>
                          </div>
                        </AsyncForm>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
