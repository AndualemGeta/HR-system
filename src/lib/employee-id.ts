import { EMPLOYEE_ID_PREFIX } from "./constants";

const employeeIdPattern = new RegExp(`^${EMPLOYEE_ID_PREFIX}_(\\d{4,})$`);

export function parseEmployeeSequence(employeeId: string | null | undefined): number | null {
  if (!employeeId) return null;
  const match = employeeId.match(employeeIdPattern);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function isValidEmployeeId(employeeId: string | null | undefined): boolean {
  return parseEmployeeSequence(employeeId) !== null;
}

export function formatEmployeeId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Employee ID sequence must be a positive integer.");
  }

  return `${EMPLOYEE_ID_PREFIX}_${sequence.toString().padStart(4, "0")}`;
}

export function nextEmployeeId(existingIds: Array<string | null | undefined>): string {
  const maxSequence = existingIds.reduce((max, employeeId) => {
    const sequence = parseEmployeeSequence(employeeId);
    return sequence && sequence > max ? sequence : max;
  }, 0);

  return formatEmployeeId(maxSequence + 1);
}
