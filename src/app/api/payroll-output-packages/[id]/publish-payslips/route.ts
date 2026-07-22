import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { publishPayslips } from '@/lib/payroll/payslip'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payslip.publish'))) return forbidden()

    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id } })
    if (!pkg) return notFound()

    const result = await publishPayslips(id, session.userId)
    if (!result.success) return badRequest(result.error || 'Publish failed')

    await createAuditLog({
      userId: session.userId, action: 'PAYSLIP_PUBLISH' as never,
      entityType: 'PayrollOutputPackage', entityId: id,
      newValue: { publishedCount: result.count },
    })
    return success({ publishedCount: result.count })
  } catch (e) { console.error(e); return internalError() }
}
