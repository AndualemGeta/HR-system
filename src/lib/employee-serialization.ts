type EmployeePayload = Record<string, unknown>;

export function serializeEmployeeForPrincipal<T extends EmployeePayload>(
  employee: T,
  canSeeSalary: boolean
): EmployeePayload {
  if (canSeeSalary) {
    return {
      ...employee,
      salaryRestricted: false
    };
  }

  const { basicSalary, salaryEffectiveDate, salaries, ...redacted } = employee;
  void basicSalary;
  void salaryEffectiveDate;
  void salaries;

  return {
    ...redacted,
    salaryRestricted: true
  };
}

export function serializeEmployeesForPrincipal<T extends EmployeePayload>(
  employees: T[],
  canSeeSalary: boolean
): EmployeePayload[] {
  return employees.map((employee) => serializeEmployeeForPrincipal(employee, canSeeSalary));
}
