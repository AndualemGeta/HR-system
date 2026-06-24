"use client";

import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { employeeRoles, employmentStatuses } from "@/lib/constants";

interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  currentRole: string;
  currentDepartment?: { name: string } | null;
  currentRegion?: { name: string } | null;
  directManager?: { fullName: string } | null;
  employmentStatus: string;
}

const columns: TableColumn<Employee>[] = [
  {
    key: "employeeId",
    header: "Employee ID",
    render: (row) => <Link href={`/employees/${row.employeeId}`}>{row.employeeId}</Link>
  },
  {
    key: "fullName",
    header: "Full Name",
    render: (row) => <Link href={`/employees/${row.employeeId}`}>{row.fullName}</Link>
  },
  { key: "currentRole", header: "Role" },
  {
    key: "currentDepartment",
    header: "Department",
    render: (row) => row.currentDepartment?.name || "-"
  },
  {
    key: "currentRegion",
    header: "Location",
    render: (row) => row.currentRegion?.name || "-"
  },
  {
    key: "directManager",
    header: "Direct Manager",
    render: (row) => row.directManager?.fullName || "-"
  },
  {
    key: "employmentStatus",
    header: "Status",
    render: (row) => <Badge tone={row.employmentStatus === "ACTIVE" ? "green" : "amber"}>{row.employmentStatus}</Badge>
  }
];

export function EmployeesClient({ canCreateEmployee }: Readonly<{ canCreateEmployee: boolean }>) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch("/api/employees");
        if (!response.ok) throw new Error("Failed to fetch employees");

        const data = await response.json();
        setEmployees(data.employees || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [
          employee.employeeId,
          employee.fullName,
          employee.currentRole,
          employee.currentDepartment?.name,
          employee.currentRegion?.name,
          employee.directManager?.fullName,
          employee.employmentStatus
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const matchesStatus = statusFilter.length === 0 || employee.employmentStatus === statusFilter;
      const matchesRole = roleFilter.length === 0 || employee.currentRole === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [employees, query, roleFilter, statusFilter]);

  const hasFilters = query.trim().length > 0 || statusFilter.length > 0 || roleFilter.length > 0;

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setRoleFilter("");
  }

  return (
    <>
      <header className="page-header">
        <div className="page-title">
          <h2>Employee List</h2>
          <p>Master data for field, sales, and Head Office employees with role, manager, evaluator, and assignment status.</p>
        </div>
        {canCreateEmployee && (
          <Link className="button" href="/employees/new">
            <Plus size={16} aria-hidden="true" />
            New
          </Link>
        )}
      </header>
      <section className="panel">
        <div className="panel-header">
          <h3>Employees</h3>
          <span>
            {isLoading ? "Loading..." : `${filteredEmployees.length} of ${employees.length} records`}
          </span>
        </div>
        <div className="filter-bar" aria-label="Employee filters">
          <label className="filter-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="search"
              placeholder="Search ID, name, role, location, manager..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {employmentStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select className="select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            {employeeRoles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <button className="button secondary" type="button" onClick={resetFilters} disabled={!hasFilters}>
            <X size={16} aria-hidden="true" />
            Reset
          </button>
        </div>
        {error && (
          <div className="form-message error">
            Error loading employees: {error}
          </div>
        )}
        {isLoading ? (
          <div style={{ padding: "32px", textAlign: "center" }}>Loading employees...</div>
        ) : (
          <DataTable columns={columns} rows={filteredEmployees} />
        )}
      </section>
    </>
  );
}
