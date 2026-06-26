import { prisma } from './prisma'
import { userHasPermission, canViewEmployee } from './rbac'

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function canViewDocument(userId: string, documentId: string): Promise<boolean> {
  const doc = await prisma.employeeDocument.findUnique({ where: { id: documentId } })
  if (!doc || !doc.isActive) return false

  const hasDocView = await userHasPermission(userId, 'document.view')

  if (doc.visibilityLevel === 'SENSITIVE_HR_ONLY') {
    return hasDocView
  }
  if (doc.visibilityLevel === 'SALARY_RESTRICTED') {
    const hasSalaryView = await userHasPermission(userId, 'salary.view')
    return hasDocView && hasSalaryView
  }
  if (doc.visibilityLevel === 'PUBLIC_TO_HR') {
    return hasDocView
  }
  if (doc.visibilityLevel === 'MANAGER_VISIBLE') {
    const inScope = await canViewEmployee(userId, doc.employeeId)
    return hasDocView && inScope
  }
  if (doc.visibilityLevel === 'EMPLOYEE_VISIBLE') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } })
    if (user?.employeeId === doc.employeeId) return true
    return hasDocView
  }
  return hasDocView
}

export async function canDownloadDocument(userId: string, documentId: string): Promise<boolean> {
  const canView = await canViewDocument(userId, documentId)
  if (!canView) return false
  return userHasPermission(userId, 'document.download')
}

export interface RequiredDocumentStatus {
  ruleId: string
  ruleName: string
  documentType: string
  isSatisfied: boolean
  matchingDocumentId: string | null
  matchingDocumentName: string | null
  visibilityLevel: string
  employeeCategory: string | null
  employeeRole: string | null
  employmentType: string | null
}

export async function getRequiredDocumentStatus(employeeId: string): Promise<RequiredDocumentStatus[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      employeeCategory: true,
      currentRole: true,
      employmentType: true,
      currentDepartmentId: true,
      currentDivisionId: true,
    },
  })
  if (!employee) return []

  const rules = await prisma.requiredDocumentRule.findMany({
    where: { isActive: true },
  })

  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId, isActive: true },
  })

  return rules.map(rule => {
    let applicable = true

    if (rule.applicableEmployeeCategory && rule.applicableEmployeeCategory !== employee.employeeCategory) {
      applicable = false
    }
    if (rule.applicableRole && rule.applicableRole !== employee.currentRole) {
      applicable = false
    }
    if (rule.applicableEmploymentType && rule.applicableEmploymentType !== employee.employmentType) {
      applicable = false
    }
    if (rule.applicableDepartmentId && rule.applicableDepartmentId !== employee.currentDepartmentId) {
      applicable = false
    }
    if (rule.applicableDivisionId && rule.applicableDivisionId !== employee.currentDivisionId) {
      applicable = false
    }

    if (!applicable) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        documentType: rule.documentType,
        isSatisfied: true,
        matchingDocumentId: null,
        matchingDocumentName: null,
        visibilityLevel: 'PUBLIC_TO_HR',
        employeeCategory: employee.employeeCategory,
        employeeRole: employee.currentRole,
        employmentType: employee.employmentType,
      }
    }

    const matchingDoc = documents.find(d => d.documentType === rule.documentType)

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      documentType: rule.documentType,
      isSatisfied: !!matchingDoc,
      matchingDocumentId: matchingDoc?.id || null,
      matchingDocumentName: matchingDoc?.originalFilename || null,
      visibilityLevel: matchingDoc?.visibilityLevel || 'PUBLIC_TO_HR',
      employeeCategory: employee.employeeCategory,
      employeeRole: employee.currentRole,
      employmentType: employee.employmentType,
    }
  })
}
