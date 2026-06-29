import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'
import { getPayrollReadinessList } from '@/lib/payroll-readiness'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.payrollReadiness.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId') || undefined
    const regionId = searchParams.get('regionId') || undefined
    const areaId = searchParams.get('areaId') || undefined
    const shopId = searchParams.get('shopId') || undefined
    const role = searchParams.get('role') || undefined
    const employmentStatus = searchParams.get('employmentStatus') || undefined
    const readinessStatus = searchParams.get('readinessStatus') || undefined

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)

    const results = await getPayrollReadinessList({
      departmentId, regionId, areaId, shopId, role, employmentStatus, readinessStatus,
      scopeWhere,
    })

    const summary = {
      total: results.length,
      ready: results.filter(r => r.overallStatus === 'READY').length,
      warning: results.filter(r => r.overallStatus === 'WARNING').length,
      notReady: results.filter(r => r.overallStatus === 'NOT_READY').length,
      inactive: results.filter(r => r.overallStatus === 'INACTIVE').length,
    }

    return success({ employees: results, summary })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
