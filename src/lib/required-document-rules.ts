import type { EmployeeRoleValue, EmploymentTypeValue } from "@/lib/constants";

export type RequiredDocumentRuleInput = {
  id?: string;
  name: string;
  documentType: string;
  applicableEmploymentType?: EmploymentTypeValue | null;
  applicableRole?: EmployeeRoleValue | null;
  applicableDepartmentId?: string | null;
  applicableDivisionId?: string | null;
  isRequired: boolean;
  activeStatus: boolean;
};

export type DocumentComplianceEmployee = {
  id: string;
  employeeId: string;
  fullName: string;
  employmentType?: EmploymentTypeValue | null;
  currentRole: EmployeeRoleValue;
  currentDepartmentId?: string | null;
  currentDivisionId?: string | null;
};

export type EmployeeDocumentSummary = {
  documentType: string;
  isActive: boolean;
};

export const defaultRequiredDocumentRules: RequiredDocumentRuleInput[] = [
  rule("Full-time ID", "ID", { employmentType: "FULL_TIME" }),
  rule("Full-time contract", "CONTRACT", { employmentType: "FULL_TIME" }),
  rule("Full-time emergency contact", "EMERGENCY_CONTACT", { employmentType: "FULL_TIME" }),
  rule("Full-time bank or payment information", "BANK_OR_PAYMENT_INFORMATION", { employmentType: "FULL_TIME" }),
  rule("Part-time ID", "ID", { employmentType: "PART_TIME" }),
  rule("Part-time contract", "CONTRACT", { employmentType: "PART_TIME" }),
  rule("Part-time emergency contact", "EMERGENCY_CONTACT", { employmentType: "PART_TIME" }),
  rule("Commission ID", "ID", { employmentType: "COMMISSION_BASED" }),
  rule("Commission agreement", "COMMISSION_AGREEMENT", { employmentType: "COMMISSION_BASED" }),
  rule("Commission contract or service agreement", "CONTRACT_OR_SERVICE_AGREEMENT", { employmentType: "COMMISSION_BASED" }),
  rule("Commission plan acknowledgement", "COMMISSION_PLAN_ACKNOWLEDGEMENT", { employmentType: "COMMISSION_BASED" }),
  rule("Shop manager assignment letter", "ASSIGNMENT_LETTER", { role: "SHOP_MANAGER" }),
  rule("Shop manager responsibility document", "RESPONSIBILITY_DOCUMENT", { role: "SHOP_MANAGER" }),
  rule("Finance confidentiality document", "CONFIDENTIALITY_DOCUMENT", { role: "FINANCE_DIRECTOR" }),
  rule("Finance responsibility document", "RESPONSIBILITY_DOCUMENT", { role: "FINANCE_DIRECTOR" }),
  rule("HR confidentiality document", "CONFIDENTIALITY_DOCUMENT", { role: "HR_MANAGER" }),
  rule("HR officer confidentiality document", "CONFIDENTIALITY_DOCUMENT", { role: "HR_OFFICER" })
];

export function requiredDocumentsForEmployee(
  employee: DocumentComplianceEmployee,
  rules: RequiredDocumentRuleInput[] = defaultRequiredDocumentRules
): RequiredDocumentRuleInput[] {
  return rules.filter((candidate) => candidate.activeStatus && candidate.isRequired && appliesToEmployee(candidate, employee));
}

export function missingRequiredDocuments(
  employee: DocumentComplianceEmployee,
  documents: EmployeeDocumentSummary[],
  rules: RequiredDocumentRuleInput[] = defaultRequiredDocumentRules
) {
  const activeDocumentTypes = new Set(documents.filter((document) => document.isActive).map((document) => document.documentType));
  return requiredDocumentsForEmployee(employee, rules).filter((candidate) => !activeDocumentTypes.has(candidate.documentType));
}

export function documentCompliancePercentage(
  employee: DocumentComplianceEmployee,
  documents: EmployeeDocumentSummary[],
  rules: RequiredDocumentRuleInput[] = defaultRequiredDocumentRules
): number {
  const required = requiredDocumentsForEmployee(employee, rules);
  if (required.length === 0) return 100;
  return Math.round(((required.length - missingRequiredDocuments(employee, documents, rules).length) / required.length) * 100);
}

export function requiredDocumentDataQualityIssues(
  employee: DocumentComplianceEmployee,
  documents: EmployeeDocumentSummary[],
  rules: RequiredDocumentRuleInput[] = defaultRequiredDocumentRules
) {
  return missingRequiredDocuments(employee, documents, rules).map((missing) => ({
    employeeId: employee.id,
    employeeCode: employee.employeeId,
    employee: employee.fullName,
    issueType: "MISSING_DOCUMENT",
    severity: "WARNING" as const,
    description: `${employee.fullName} is missing required document: ${missing.documentType}.`,
    suggestedFix: `Upload an active ${missing.documentType} document or update the required document rule if it does not apply.`
  }));
}

function appliesToEmployee(ruleInput: RequiredDocumentRuleInput, employee: DocumentComplianceEmployee): boolean {
  if (ruleInput.applicableEmploymentType && ruleInput.applicableEmploymentType !== employee.employmentType) return false;
  if (ruleInput.applicableRole && ruleInput.applicableRole !== employee.currentRole) return false;
  if (ruleInput.applicableDepartmentId && ruleInput.applicableDepartmentId !== employee.currentDepartmentId) return false;
  if (ruleInput.applicableDivisionId && ruleInput.applicableDivisionId !== employee.currentDivisionId) return false;
  return Boolean(ruleInput.applicableEmploymentType || ruleInput.applicableRole || ruleInput.applicableDepartmentId || ruleInput.applicableDivisionId);
}

function rule(
  name: string,
  documentType: string,
  scope: { employmentType?: EmploymentTypeValue; role?: EmployeeRoleValue }
): RequiredDocumentRuleInput {
  return {
    name,
    documentType,
    applicableEmploymentType: scope.employmentType ?? null,
    applicableRole: scope.role ?? null,
    applicableDepartmentId: null,
    applicableDivisionId: null,
    isRequired: true,
    activeStatus: true
  };
}
