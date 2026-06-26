import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.view')) && !(await userHasPermission(session.userId, 'document.manageRules'))) return forbidden()

    const rules = await prisma.requiredDocumentRule.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return success(rules)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.manageRules'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    if (!body.name || !body.documentType) return badRequest('name and documentType are required')

    const validDocTypes = ['ID', 'CONTRACT', 'CV', 'CERTIFICATE', 'EMERGENCY_CONTACT', 'BANK_OR_PAYMENT_INFORMATION', 'TAX_OR_PAYROLL_INFORMATION', 'COMMISSION_AGREEMENT', 'ASSIGNMENT_LETTER', 'RESPONSIBILITY_DOCUMENT', 'CONFIDENTIALITY_DOCUMENT', 'SALARY_DOCUMENT', 'OTHER']
    if (!validDocTypes.includes(body.documentType)) return badRequest('Invalid document type')

    const rule = await prisma.requiredDocumentRule.create({
      data: {
        name: body.name,
        documentType: body.documentType as never,
        applicableEmploymentType: body.applicableEmploymentType || null,
        applicableRole: body.applicableRole || null,
        applicableDepartmentId: body.applicableDepartmentId || null,
        applicableDivisionId: body.applicableDivisionId || null,
        applicableEmployeeCategory: body.applicableEmployeeCategory || null,
        isRequired: body.isRequired !== false,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_RULE_CREATE',
      entityType: 'RequiredDocumentRule',
      entityId: rule.id,
      newValue: { name: rule.name, documentType: rule.documentType },
    })

    return success(rule, 201)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
