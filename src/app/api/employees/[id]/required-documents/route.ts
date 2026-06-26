import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { getRequiredDocumentStatus } from '@/lib/documents'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, employeeId: true, fullName: true, employeeCategory: true, currentRole: true, employmentType: true, currentDepartmentId: true, currentRegionId: true, currentAreaId: true, currentShopId: true, directManagerId: true, accountingReportingManagerId: true, employmentStatus: true },
    })
    if (!employee) return notFound()

    const docStatus = await getRequiredDocumentStatus(id)
    const satisfied = docStatus.filter(d => d.isSatisfied).length
    const total = docStatus.filter(d => !d.isSatisfied || d.isSatisfied).length
    const applicable = docStatus.filter(d => !d.isSatisfied)
    const completionPct = total > 0 ? Math.round((satisfied / total) * 100) : 100

    const blockers: string[] = []
    if (applicable.length > 0) blockers.push(`Missing ${applicable.length} required document(s)`)

    return success({
      employee: { id: employee.id, employeeId: employee.employeeId, fullName: employee.fullName },
      rules: docStatus,
      satisfied,
      total,
      completionPercentage: completionPct,
      missing: applicable,
      blockers,
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
