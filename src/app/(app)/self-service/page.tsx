import Link from "next/link";
import { ProfileChangeField } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { SelfServiceLeaveForm } from "@/components/phase2/self-service-leave-form";
import { SelfServiceDocumentUpload } from "@/components/phase2/self-service-document-upload";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function SelfServicePage() {
  const principal = await requirePagePermission("self_service.view");
  const employee = principal.employeeId
    ? await prisma.employee.findUnique({
        where: { id: principal.employeeId },
        include: {
          documents: { where: { isActive: true, visibilityLevel: "EMPLOYEE_VISIBLE" }, take: 20 },
          leaveRecords: { orderBy: { createdAt: "desc" }, take: 20 },
          achievements: { where: { approvalStatus: "APPROVED" }, orderBy: { achievementDate: "desc" }, take: 20 },
          evaluationsReceived: { where: { status: "APPROVED" }, orderBy: { evaluationPeriodEnd: "desc" }, take: 20 },
          terminations: { orderBy: { createdAt: "desc" }, take: 5 },
          kpiResults: { include: { metric: true }, orderBy: { periodEnd: "desc" }, take: 10 },
          profileChangeRequests: { orderBy: { createdAt: "desc" }, take: 10 }
        }
      })
    : null;

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Self Service</h2>
          <p>Access your profile, approved records, visible documents, KPI results, profile change requests, and exit status.</p>
        </div>
      </header>

      {!employee && (
        <section className="panel">
          <div className="panel-header">
            <h3>No Linked Employee</h3>
            <span>Ask HR to link your user account.</span>
          </div>
        </section>
      )}

      {employee && (
        <div className="grid two">
          <section className="panel">
            <div className="panel-header">
              <h3>{employee.fullName}</h3>
              <Badge>{employee.employmentStatus}</Badge>
            </div>
            <div className="matrix">
              <div className="mini-card"><span>Employee ID</span><strong>{employee.employeeId}</strong></div>
              <div className="mini-card"><span>Role</span><strong>{employee.currentRole}</strong></div>
              <div className="mini-card"><span>Type</span><strong>{employee.employmentType ?? "Not set"}</strong></div>
              <div className="mini-card"><span>Level</span><strong>{employee.currentLevel}</strong></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Documents</h3>
              <span>{employee.documents.length} visible</span>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {employee.documents.map((document) => (
                <Link className="mini-card" href={`/api/documents/${document.id}`} key={document.id}>
                  <strong>{document.documentType}</strong>
                  <span>{document.originalFilename ?? "Document"}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Profile Change</h3>
              <span>{employee.profileChangeRequests.length} recent</span>
            </div>
            <AsyncForm action="/api/profile-change-requests" className="grid">
              <div className="form-grid">
                <label>
                  Field
                  <select className="select" name="requestedField">
                    {Object.values(ProfileChangeField).map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
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
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              {employee.profileChangeRequests.map((request) => (
                <div className="mini-card" key={request.id}>
                  <strong>{request.requestedField}</strong>
                  <span>{request.status} / {request.createdAt.toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Request Leave</h3>
              <span>Submit for HR approval</span>
            </div>
            <SelfServiceLeaveForm />
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Upload Document</h3>
              <span>Employee-visible only</span>
            </div>
            <SelfServiceDocumentUpload />
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Leave Records</h3>
              <span>{employee.leaveRecords.length} recent</span>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {employee.leaveRecords.map((leave) => (
                <div className="mini-card" key={leave.id}>
                  <strong>{leave.leaveType}</strong>
                  <span>{leave.approvalStatus} / {leave.startDate.toLocaleDateString()} - {leave.endDate.toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>KPI Results</h3>
              <span>{employee.kpiResults.length} recent</span>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {employee.kpiResults.map((result) => (
                <div className="mini-card" key={result.id}>
                  <strong>{result.metric.name}</strong>
                  <span>{result.rating} / actual {result.actualValue.toString()} / {result.periodEnd.toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Exit Status</h3>
              <span>{employee.terminations.length} cases</span>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {employee.terminations.map((termination) => (
                <div className="mini-card" key={termination.id}>
                  <strong>{termination.terminationType}</strong>
                  <span>{termination.status} / clearance {termination.clearanceStatus}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
