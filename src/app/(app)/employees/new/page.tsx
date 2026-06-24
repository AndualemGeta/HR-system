"use client";

import { Save, CheckCircle, AlertCircle } from "lucide-react";
import { employeeRoles, employmentStatuses, employmentTypes } from "@/lib/constants";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CreatedEmployee = {
  employeeId: string;
  fullName: string;
};

type EmployeeCreateResponse = {
  employee: CreatedEmployee;
};

export default function CreateEmployeePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployee | null>(null);
  const [canEditSalary, setCanEditSalary] = useState(false);

  useEffect(() => {
    async function loadPrincipal() {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return;
      const data = (await response.json()) as { principal?: { systemRoles?: string[] } | null };
      const roles = data.principal?.systemRoles ?? [];
      setCanEditSalary(roles.includes("SUPER_ADMIN") || roles.includes("HR_ADMIN"));
    }

    loadPrincipal().catch(() => setCanEditSalary(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCreatedEmployee(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        setErrorMessage(error.details || error.error || "Failed to create employee");
        setSuccessMessage(null);
        setIsLoading(false);
        return;
      }

      const result = (await response.json()) as EmployeeCreateResponse;
      setCreatedEmployee(result.employee);
      setSuccessMessage(`Employee created successfully. ID: ${result.employee.employeeId}`);
      setErrorMessage(null);

      e.currentTarget.reset();

      setTimeout(() => {
        router.push("/employees");
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      setErrorMessage(message);
      setSuccessMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Create Employee</h2>
          <p>Employee ID is generated globally as LSTA_0001, LSTA_0002, LSTA_0003, and never resets by division, shop, or region.</p>
        </div>
      </header>

      {successMessage && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px",
          marginBottom: "16px",
          backgroundColor: "#d4edda",
          border: "1px solid #c3e6cb",
          borderRadius: "4px",
          color: "#155724"
        }}>
          <CheckCircle size={20} style={{ flexShrink: 0, color: "#28a745" }} />
          <div>
            <strong>{successMessage}</strong>
            {createdEmployee && (
              <p style={{ marginTop: "8px", fontSize: "14px", marginBottom: 0 }}>
                Name: {createdEmployee.fullName}. Redirecting to employee list...
              </p>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px",
          marginBottom: "16px",
          backgroundColor: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: "4px",
          color: "#721c24"
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, color: "#dc3545" }} />
          <div>
            <strong>Error creating employee</strong>
            <p style={{ marginTop: "8px", fontSize: "14px", marginBottom: 0 }}>{errorMessage}</p>
          </div>
        </div>
      )}

      <form className="panel grid" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            First name
            <input className="field" name="firstName" required />
          </label>
          <label>
            Middle name
            <input className="field" name="middleName" />
          </label>
          <label>
            Last name
            <input className="field" name="lastName" required />
          </label>
          <label>
            Email
            <input className="field" name="email" type="email" />
          </label>
          <label>
            Phone number
            <input className="field" name="phoneNumber" />
          </label>
          <label>
            Hire date
            <input className="field" name="hireDate" type="date" />
          </label>
          <label>
            Employment type
            <select className="select" name="employmentType">
              <option value="">To be confirmed</option>
              {employmentTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Employment status
            <select className="select" name="employmentStatus" defaultValue="DRAFT">
              {employmentStatuses.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select className="select" name="currentRole" defaultValue="OTHER">
              {employeeRoles.map((role) => (
                <option value={role} key={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department
            <input className="field" name="currentDepartmentId" />
          </label>
          <label>
            Region
            <input className="field" name="currentRegionId" />
          </label>
          <label>
            Shop
            <input className="field" name="currentShopId" />
          </label>
          <label>
            Cluster
            <input className="field" name="currentClusterId" />
          </label>
          <label>
            Direct manager
            <input className="field" name="directManagerId" />
          </label>
          <label>
            Evaluator
            <input className="field" name="currentEvaluatorId" />
          </label>
          {canEditSalary && (
            <label>
              Basic salary
              <input className="field" name="basicSalary" type="number" min="0" step="0.01" />
            </label>
          )}
          <label className="wide">
            Address
            <textarea className="textarea" name="address" />
          </label>
        </div>
        <div className="toolbar">
          <button className="button" type="submit" disabled={isLoading}>
            <Save size={16} aria-hidden="true" />
            {isLoading ? "Creating..." : "Save employee"}
          </button>
        </div>
      </form>
    </>
  );
}
