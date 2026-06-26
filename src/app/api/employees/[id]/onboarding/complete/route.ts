import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { getRequiredDocumentStatus } from '@/lib/documents'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'onboarding.complete'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, employeeCategory: true, currentRole: true, currentDepartmentId: true, currentRegionId: true, currentAreaId: true, currentShopId: true, directManagerId: true, accountingReportingManagerId: true, employmentStatus: true },
    })
    if (!employee) return notFound()

    const body = await req.json().catch(() => ({}))
    const isOverride = body.override === true
    const overrideReason = body.overrideReason || ''

    const blockers: string[] = []

    // Check required documents
    const docStatus = await getRequiredDocumentStatus(id)
    const missingDocs = docStatus.filter(d => !d.isSatisfied)
    if (missingDocs.length > 0 && !isOverride) {
      blockers.push(`Missing ${missingDocs.length} required document(s)`)
    }

    // Check category
    if (!employee.employeeCategory) blockers.push('Employee category is not set')
    if (!employee.currentRole) blockers.push('Employee role is not set')

    // Head Office checks
    if (employee.employeeCategory === 'HEAD_OFFICE') {
      if (!employee.currentDepartmentId) blockers.push('Head Office employee must have a department')
    }

    // Shop/Field checks
    if (employee.employeeCategory === 'SHOP_FIELD') {
      if (!employee.currentRegionId) blockers.push('Shop/Field employee must have a region')
      if (['SHOP_MANAGER', 'DSP', 'DSA', 'SHOP_ACCOUNTANT'].includes(employee.currentRole || '') && !employee.currentAreaId) {
        blockers.push(`${employee.currentRole} must have an area`)
      }
      if (['SHOP_MANAGER', 'DSP', 'DSA', 'SHOP_ACCOUNTANT'].includes(employee.currentRole || '') && !employee.currentShopId) {
        blockers.push(`${employee.currentRole} must have a shop`)
      }
    }

    // Manager check (skip for CEO)
    if (employee.currentRole !== 'CEO' && !employee.directManagerId) {
      blockers.push('Employee must have a direct manager')
    }

    // Shop Accountant accounting manager check
    if (employee.currentRole === 'SHOP_ACCOUNTANT' && !employee.accountingReportingManagerId) {
      blockers.push('Shop Accountant must have an accounting reporting manager')
    }

    // Checklist items
    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { employeeId: id },
      include: { items: true },
    })

    if (checklist) {
      const incompleteItems = checklist.items.filter(i => !i.completed)
      if (incompleteItems.length > 0 && !isOverride) {
        blockers.push(`${incompleteItems.length} checklist item(s) not completed`)
      }
    }

    if (blockers.length > 0 && !isOverride) {
      return success({ canComplete: false, blockers, overrideAvailable: true })
    }

    // Complete onboarding
    if (checklist) {
      await prisma.onboardingChecklist.update({
        where: { id: checklist.id },
        data: { status: 'APPROVED', completedAt: new Date() },
      })
      // Mark all incomplete items as completed if overriding
      if (isOverride) {
        const incompleteItems = checklist.items.filter(i => !i.completed)
        for (const item of incompleteItems) {
          await prisma.onboardingChecklistItem.update({
            where: { id: item.id },
            data: { completed: true, completedById: session.userId, completedAt: new Date() },
          })
        }
      }
    } else {
      // Create checklist and mark complete
      const newChecklist = await prisma.onboardingChecklist.create({
        data: { employeeId: id, status: 'APPROVED', completedAt: new Date() },
      })
      await prisma.onboardingChecklistItem.create({
        data: { checklistId: newChecklist.id, key: 'documents_uploaded', label: 'Required Documents Uploaded', completed: true, completedById: session.userId, completedAt: new Date() },
      })
    }

    if (isOverride) {
      await createAuditLog({
        userId: session.userId,
        action: 'ONBOARDING_OVERRIDE',
        entityType: 'Employee',
        entityId: id,
        newValue: { reason: overrideReason, blockers },
      })
    } else {
      await createAuditLog({
        userId: session.userId,
        action: 'ONBOARDING_COMPLETE',
        entityType: 'Employee',
        entityId: id,
        newValue: { status: 'APPROVED' },
      })
    }

    return success({ canComplete: true, blockers: [], overrideUsed: isOverride, overrideReason: isOverride ? overrideReason : null })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
