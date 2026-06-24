import { DocumentType, DocumentVisibility } from "@prisma/client";
import Link from "next/link";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canViewDocument, employeeToScope } from "@/lib/phase2-access";
import { canViewEmployee, hasPermission } from "@/lib/rbac";
import { employeeScopeSelect, filterVisibleEmployees } from "@/lib/scope";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function DocumentsPage() {
  const principal = await requirePagePermission("document.view");
  const [documents, allEmployees] = await Promise.all([
    prisma.employeeDocument.findMany({
      where: { isActive: true },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            currentRole: true,
            currentDepartmentId: true,
            currentRegionId: true,
            currentShopId: true,
            currentClusterId: true,
            directManagerId: true
          }
        }
      },
      orderBy: { uploadedAt: "desc" },
      take: 100
    }),
    prisma.employee.findMany({
      select: employeeScopeSelect,
      orderBy: { fullName: "asc" },
      take: 200
    })
  ]);
  const employees = filterVisibleEmployees(principal, allEmployees, canViewEmployee);

  const visibleDocuments = documents.filter((document) =>
    canViewDocument(principal, {
      employeeId: document.employeeId,
      visibilityLevel: document.visibilityLevel,
      employee: employeeToScope(document.employee)
    })
  );

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Employee Documents</h2>
          <p>Upload and view employee documents with HR, manager, employee, sensitive, and salary-restricted visibility.</p>
        </div>
      </header>

      {hasPermission(principal, "document.upload") && (
        <AsyncForm action="/api/documents">
          <div className="form-grid">
            <label>
              Employee
              <select className="select" name="employeeId" required>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeId} - {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Document type
              <select className="select" name="documentType" required>
                {Object.values(DocumentType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select className="select" name="visibilityLevel" defaultValue="PUBLIC_TO_HR">
                {Object.values(DocumentVisibility).map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {visibility}
                  </option>
                ))}
              </select>
            </label>
            <label>
              File
              <input className="field" name="file" type="file" required />
            </label>
            <label className="wide">
              Notes
              <textarea className="textarea" name="notes" />
            </label>
          </div>
        </AsyncForm>
      )}

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Documents</h3>
          <span>{visibleDocuments.length} visible</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {visibleDocuments.map((document) => (
            <div className="mini-card" key={document.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{document.originalFilename ?? document.filePath}</strong>
                <Badge tone={document.visibilityLevel === "SALARY_RESTRICTED" ? "amber" : "blue"}>
                  {document.visibilityLevel}
                </Badge>
              </div>
              <span>
                {document.employee.employeeId} - {document.employee.fullName}
              </span>
              <span>
                {document.documentType} - {document.uploadedAt.toLocaleDateString()}
              </span>
              <div className="toolbar">
                <Link className="button secondary" href={`/api/documents/${document.id}`}>
                  View
                </Link>
                <Link className="button secondary" href={`/api/documents/${document.id}?download=1`}>
                  Download
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
