import { EmployeeRole } from "@prisma/client";
import { AsyncForm } from "@/components/phase2/async-form";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/security/page-auth";

export default async function EvaluationCriteriaPage() {
  await requirePagePermission("evaluation.configure");
  const [criteria, departments] = await Promise.all([
    prisma.evaluationCriteria.findMany({
      include: { applicableDepartment: true },
      orderBy: [{ activeStatus: "desc" }, { name: "asc" }]
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Evaluation Criteria</h2>
          <p>Configure weighted evaluation criteria by role or department.</p>
        </div>
      </header>

      <AsyncForm action="/api/evaluation-criteria">
        <div className="form-grid">
          <label>
            Name
            <input className="field" name="name" required />
          </label>
          <label>
            Applicable role
            <select className="select" name="applicableRole" defaultValue="">
              <option value="">All roles</option>
              {Object.values(EmployeeRole).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Applicable department
            <select className="select" name="applicableDepartmentId" defaultValue="">
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Weight
            <input className="field" name="weight" type="number" min="0.01" step="0.01" defaultValue="1" />
          </label>
          <label>
            Max score
            <input className="field" name="maxScore" type="number" min="1" defaultValue="100" />
          </label>
          <label className="wide">
            Description
            <textarea className="textarea" name="description" />
          </label>
        </div>
      </AsyncForm>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h3>Configured Criteria</h3>
          <span>{criteria.length} records</span>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {criteria.map((item) => (
            <div className="mini-card" key={item.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{item.name}</strong>
                <Badge tone={item.activeStatus ? "green" : "red"}>{item.activeStatus ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
              <span>
                {item.applicableRole ?? "All roles"} - {item.applicableDepartment?.name ?? "All departments"}
              </span>
              <span>
                Weight {item.weight.toString()} / max {item.maxScore}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
