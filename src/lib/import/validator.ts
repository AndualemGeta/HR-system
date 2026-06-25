import type { EmployeeRoleValue, EmploymentStatusValue, EmploymentTypeValue } from "../constants";
import { nextEmployeeId } from "../employee-id";
import {
  defaultLevelForRole,
  normalizeEmploymentType,
  normalizeRole,
  normalizeStatus
} from "./normalize";
import { validateEmployeeLifecycle, type ValidationResult } from "../validation";

export type SourceRow = Record<string, unknown>;

export type ImportValidationContext = {
  existingEmployeeIds: string[];
  existingContacts?: Array<{ fullName: string; phoneNumber?: string | null; email?: string | null }>;
  knownManagers?: Set<string>;
  knownEvaluators?: Set<string>;
  fieldMapping?: ImportFieldMapping;
};

export type NormalizedImportRow = {
  employeeId: string;
  employeeIdGenerated: boolean;
  fullName: string;
  division?: string | null;
  department?: string | null;
  region?: string | null;
  shop?: string | null;
  cluster?: string | null;
  role: string | null;
  sourceRoleValue?: string | null;
  level: string;
  directManager?: string | null;
  evaluator?: string | null;
  employmentType: string | null;
  employmentStatus: string;
  basicSalary?: number | null;
};

export type ImportRowValidation = {
  rowNumber: number;
  sourceData: SourceRow;
  normalizedData: NormalizedImportRow;
  blockers: ValidationResult["blockers"];
  warnings: ValidationResult["warnings"];
  reviewItems: ValidationResult["reviewItems"];
  status: "CLEAN" | "WARNING" | "REVIEW_REQUIRED" | "BLOCKED";
};

export type ImportSourceField = Exclude<keyof NormalizedImportRow, "employeeIdGenerated">;
export type ImportFieldMapping = Record<string, string>;

export const importTargetFields: Array<{ value: ImportSourceField; label: string; required: boolean }> = [
  { value: "employeeId", label: "EmployeeID", required: false },
  { value: "fullName", label: "Full Name", required: true },
  { value: "division", label: "Division", required: false },
  { value: "department", label: "Department", required: false },
  { value: "region", label: "Region", required: false },
  { value: "shop", label: "Shop", required: false },
  { value: "cluster", label: "Cluster", required: false },
  { value: "role", label: "Role", required: true },
  { value: "level", label: "Level", required: false },
  { value: "directManager", label: "Direct Manager", required: false },
  { value: "evaluator", label: "Evaluator", required: false },
  { value: "employmentType", label: "Employment Type", required: true },
  { value: "employmentStatus", label: "Employment Status", required: false },
  { value: "basicSalary", label: "Basic Salary", required: false }
];

export const requiredImportTargetFields = importTargetFields.filter((field) => field.required);

const fieldAliases: Record<ImportSourceField, string[]> = {
  employeeId: ["EmployeeID", "Employee ID", "ID", "employee_id"],
  fullName: ["Full Name", "Name", "Employee Name", "full_name"],
  division: ["Division", "current_division"],
  department: ["Department", "Head Office Department", "current_department"],
  region: ["Region", "Area", "current_region"],
  shop: ["Shop", "Branch", "current_shop"],
  cluster: ["Cluster", "current_cluster"],
  role: ["Role", "Position", "Job Title", "current_role"],
  sourceRoleValue: [],
  level: ["Level", "Seniority", "current_level"],
  directManager: ["Direct Manager", "Manager", "Reporting Manager", "direct_manager"],
  evaluator: ["Evaluator", "Current Evaluator", "current_evaluator"],
  employmentType: ["Employment Type", "Type", "employment_type"],
  employmentStatus: ["Employment Status", "Status", "employment_status"],
  basicSalary: ["Basic Salary", "Salary", "basic_salary"]
};

function readField(row: SourceRow, field: ImportSourceField, fieldMapping?: ImportFieldMapping): string | null {
  const explicitlyMapped = Object.entries(fieldMapping ?? {})
    .filter(([, targetField]) => targetField === field)
    .map(([sourceColumn]) => sourceColumn);
  const candidates = [...explicitlyMapped, ...(fieldAliases[field] ?? [])];
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function salaryToNumber(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasInvalidSalaryFormat(value: string | null): boolean {
  if (!value) return false;
  return salaryToNumber(value) === null;
}

export function validateImportRows(
  rows: SourceRow[],
  context: ImportValidationContext
): ImportRowValidation[] {
  const issuedIds = [...context.existingEmployeeIds];

  return rows.map((row, index) => {
    const read = (field: ImportSourceField) => readField(row, field, context.fieldMapping);
    const role = normalizeRole(read("role"));
    const employmentType = normalizeEmploymentType(read("employmentType"));
    const employmentStatus = normalizeStatus(read("employmentStatus"));
    const suppliedEmployeeId = read("employeeId");
    const duplicateEmployeeId = Boolean(suppliedEmployeeId && issuedIds.includes(suppliedEmployeeId));
    const employeeId = suppliedEmployeeId ?? nextEmployeeId(issuedIds);
    const salarySource = read("basicSalary");
    issuedIds.push(employeeId);

    const normalizedData: NormalizedImportRow = {
      employeeId,
      employeeIdGenerated: !suppliedEmployeeId,
      fullName: read("fullName") ?? "",
      division: read("division"),
      department: read("department"),
      region: read("region"),
      shop: read("shop"),
      cluster: read("cluster"),
      role: role.value,
      sourceRoleValue: role.sourceValue,
      level: read("level") ?? defaultLevelForRole(role.value),
      directManager: read("directManager"),
      evaluator: read("evaluator"),
      employmentType: employmentType.value,
      employmentStatus: employmentStatus.value ?? "DRAFT",
      basicSalary: salaryToNumber(salarySource)
    };

    const lifecycle = validateEmployeeLifecycle({
      employeeId: normalizedData.employeeId,
      fullName: normalizedData.fullName,
      employmentType: normalizedData.employmentType as EmploymentTypeValue,
      employmentStatus: normalizedData.employmentStatus as EmploymentStatusValue,
      currentRole: normalizedData.role as EmployeeRoleValue,
      currentDepartmentId: normalizedData.department,
      currentRegionId: normalizedData.region,
      currentShopId: normalizedData.shop,
      currentClusterId: normalizedData.cluster,
      directManagerId: normalizedData.directManager,
      currentEvaluatorId: normalizedData.evaluator,
      basicSalary: normalizedData.basicSalary,
      onboardingComplete: normalizedData.employmentStatus === "DRAFT"
    });

    if (role.reviewRequired) {
      lifecycle.reviewItems.push({
        field: "role",
        message: `Imported role "${role.sourceValue ?? ""}" needs HR review.`
      });
    }

    if (duplicateEmployeeId) {
      lifecycle.blockers.push({
        field: "employeeId",
        message: `Employee ID ${suppliedEmployeeId} already exists or appears more than once in this import.`
      });
    }

    if (normalizedData.employeeIdGenerated) {
      lifecycle.reviewItems.push({
        field: "employeeId",
        message: `Generated provisional employee ID ${normalizedData.employeeId}; HR must confirm before approval.`
      });
    }

    if (hasInvalidSalaryFormat(salarySource)) {
      lifecycle.blockers.push({
        field: "basicSalary",
        message: "Basic salary has an invalid numeric format."
      });
    }

    if (employmentType.reviewRequired) {
      lifecycle.reviewItems.push({
        field: "employmentType",
        message: "Employment type is missing or could not be confidently normalized."
      });
    }

    if (employmentStatus.reviewRequired) {
      lifecycle.reviewItems.push({
        field: "employmentStatus",
        message: "Employment status was missing or normalized to DRAFT."
      });
    }

    if (isDuplicateContact(normalizedData.fullName, row, context.existingContacts ?? [])) {
      lifecycle.warnings.push({
        field: "duplicate",
        message: "Possible duplicate employee with same name and phone or email."
      });
    }

    if (normalizedData.directManager && context.knownManagers && !context.knownManagers.has(normalizedData.directManager)) {
      lifecycle.reviewItems.push({
        field: "directManager",
        message: "Direct manager was not found in known employee records."
      });
    }

    if (normalizedData.evaluator && context.knownEvaluators && !context.knownEvaluators.has(normalizedData.evaluator)) {
      lifecycle.reviewItems.push({
        field: "evaluator",
        message: "Evaluator was not found in known employee records."
      });
    }

    const status =
      lifecycle.blockers.length > 0
        ? "BLOCKED"
        : lifecycle.reviewItems.length > 0
          ? "REVIEW_REQUIRED"
          : lifecycle.warnings.length > 0
            ? "WARNING"
            : "CLEAN";

    return {
      rowNumber: index + 2,
      sourceData: row,
      normalizedData,
      blockers: lifecycle.blockers,
      warnings: lifecycle.warnings,
      reviewItems: lifecycle.reviewItems,
      status
    };
  });
}

export function detectImportTargetField(column: string): string {
  const normalized = column.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const known: Record<string, ImportSourceField> = {
    employeeid: "employeeId",
    id: "employeeId",
    fullname: "fullName",
    name: "fullName",
    division: "division",
    department: "department",
    region: "region",
    area: "region",
    shop: "shop",
    branch: "shop",
    cluster: "cluster",
    role: "role",
    position: "role",
    jobtitle: "role",
    level: "level",
    seniority: "level",
    directmanager: "directManager",
    manager: "directManager",
    evaluator: "evaluator",
    employmenttype: "employmentType",
    type: "employmentType",
    employmentstatus: "employmentStatus",
    status: "employmentStatus",
    basicsalary: "basicSalary",
    salary: "basicSalary"
  };

  return known[normalized] ?? "unmapped";
}

export type FlatImportIssue = {
  rowNumber: number;
  severity: "BLOCKER" | "WARNING" | "REVIEW";
  fieldName: string;
  issueCode: string;
  message: string;
  suggestedFix?: string;
};

export function flattenImportIssues(rows: ImportRowValidation[]): FlatImportIssue[] {
  return rows.flatMap((row) => [
    ...row.blockers.map((issue) => toFlatIssue(row.rowNumber, "BLOCKER", issue.field, issue.message)),
    ...row.warnings.map((issue) => toFlatIssue(row.rowNumber, "WARNING", issue.field, issue.message)),
    ...row.reviewItems.map((issue) => toFlatIssue(row.rowNumber, "REVIEW", issue.field, issue.message))
  ]);
}

function toFlatIssue(
  rowNumber: number,
  severity: FlatImportIssue["severity"],
  fieldName: string,
  message: string
): FlatImportIssue {
  return {
    rowNumber,
    severity,
    fieldName,
    issueCode: `${severity}_${fieldName}`.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    message,
    suggestedFix: severity === "BLOCKER" ? "Correct the source value and re-upload or edit before approval." : undefined
  };
}

function isDuplicateContact(
  fullName: string,
  row: SourceRow,
  contacts: Array<{ fullName: string; phoneNumber?: string | null; email?: string | null }>
): boolean {
  const phone = String(row["Phone"] ?? row["Phone Number"] ?? "").trim().toLowerCase();
  const email = String(row["Email"] ?? "").trim().toLowerCase();
  const normalizedName = fullName.trim().toLowerCase();

  return contacts.some((contact) => {
    const sameName = contact.fullName.trim().toLowerCase() === normalizedName;
    const samePhone = phone && contact.phoneNumber?.trim().toLowerCase() === phone;
    const sameEmail = email && contact.email?.trim().toLowerCase() === email;
    return sameName && Boolean(samePhone || sameEmail);
  });
}
