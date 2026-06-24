import {
  defaultLevelByRole,
  employeeRoles,
  employmentTypeAliases,
  employmentTypes,
  roleAliases,
  statusAliases,
  type EmployeeRoleValue,
  type EmploymentStatusValue,
  type EmploymentTypeValue
} from "../constants";

export type NormalizedValue<T extends string> = {
  value: T | null;
  sourceValue: string | null;
  reviewRequired: boolean;
};

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeRole(value: unknown): NormalizedValue<EmployeeRoleValue> {
  const sourceValue = value == null || String(value).trim() === "" ? null : String(value).trim();
  if (!sourceValue) {
    return { value: null, sourceValue, reviewRequired: true };
  }

  const uppercase = sourceValue.trim().replace(/[\s-]+/g, "_").toUpperCase();
  if ((employeeRoles as readonly string[]).includes(uppercase)) {
    return { value: uppercase as EmployeeRoleValue, sourceValue, reviewRequired: false };
  }

  const mapped = roleAliases[normalizeToken(sourceValue)];
  return {
    value: mapped ?? "OTHER",
    sourceValue,
    reviewRequired: !mapped
  };
}

export function normalizeEmploymentType(value: unknown): NormalizedValue<EmploymentTypeValue> {
  const sourceValue = value == null || String(value).trim() === "" ? null : String(value).trim();
  if (!sourceValue) {
    return { value: null, sourceValue, reviewRequired: true };
  }

  const uppercase = sourceValue.trim().replace(/[\s-]+/g, "_").toUpperCase();
  if ((employmentTypes as readonly string[]).includes(uppercase)) {
    return { value: uppercase as EmploymentTypeValue, sourceValue, reviewRequired: false };
  }

  const mapped = employmentTypeAliases[normalizeToken(sourceValue)];
  return {
    value: mapped ?? "OTHER",
    sourceValue,
    reviewRequired: !mapped
  };
}

export function normalizeStatus(value: unknown): NormalizedValue<EmploymentStatusValue> {
  const sourceValue = value == null || String(value).trim() === "" ? null : String(value).trim();
  if (!sourceValue) {
    return { value: "DRAFT", sourceValue, reviewRequired: true };
  }

  const uppercase = sourceValue.trim().replace(/[\s-]+/g, "_").toUpperCase();
  if (Object.values(statusAliases).includes(uppercase as EmploymentStatusValue)) {
    return { value: uppercase as EmploymentStatusValue, sourceValue, reviewRequired: false };
  }

  const mapped = statusAliases[normalizeToken(sourceValue)];
  return {
    value: mapped ?? "DRAFT",
    sourceValue,
    reviewRequired: !mapped
  };
}

export function defaultLevelForRole(role: EmployeeRoleValue | null): string {
  if (!role) return "TO_BE_DEFINED";
  return defaultLevelByRole[role] ?? "TO_BE_DEFINED";
}
