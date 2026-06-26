import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, notFound, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.view')) && !(await userHasPermission(session.userId, 'document.manageRules'))) return forbidden()

    const rule = await prisma.requiredDocumentRule.findUnique({ where: { id } })
    if (!rule) return notFound()
    return success(rule)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.manageRules'))) return forbidden()

    const existing = await prisma.requiredDocumentRule.findUnique({ where: { id } })
    if (!existing) return notFound()

    const body = await req.json().catch(() => ({}))
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.documentType !== undefined) {
      const validDocTypes = ['ID', 'CONTRACT', 'CV', 'CERTIFICATE', 'EMERGENCY_CONTACT', 'BANK_OR_PAYMENT_INFORMATION', 'TAX_OR_PAYROLL_INFORMATION', 'COMMISSION_AGREEMENT', 'ASSIGNMENT_LETTER', 'RESPONSIBILITY_DOCUMENT', 'CONFIDENTIALITY_DOCUMENT', 'SALARY_DOCUMENT', 'OTHER']
      if (!validDocTypes.includes(body.documentType)) return badRequest('Invalid document type')
      updateData.documentType = body.documentType
    }
    if (body.applicableEmploymentType !== undefined) updateData.applicableEmploymentType = body.applicableEmploymentType || null
    if (body.applicableRole !== undefined) updateData.applicableRole = body.applicableRole || null
    if (body.applicableDepartmentId !== undefined) updateData.applicableDepartmentId = body.applicableDepartmentId || null
    if (body.applicableDivisionId !== undefined) updateData.applicableDivisionId = body.applicableDivisionId || null
    if (body.applicableEmployeeCategory !== undefined) updateData.applicableEmployeeCategory = body.applicableEmployeeCategory || null
    if (body.isRequired !== undefined) updateData.isRequired = body.isRequired

    const updated = await prisma.requiredDocumentRule.update({ where: { id }, data: updateData })

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_RULE_UPDATE',
      entityType: 'RequiredDocumentRule',
      entityId: id,
      oldValue: { name: existing.name, documentType: existing.documentType },
      newValue: { name: updated.name, documentType: updated.documentType },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
