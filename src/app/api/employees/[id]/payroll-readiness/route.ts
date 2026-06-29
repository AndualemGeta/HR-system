import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { getPayrollReadiness } from '@/lib/payroll-readiness'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.payrollReadiness.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const readiness = await getPayrollReadiness(id)
    if (!readiness) return notFound()

    return success(readiness)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
