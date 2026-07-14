import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'
import { validatePayeSchedule } from '@/lib/payroll-paye-validation'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ scheduleCode: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollStatutory.view'))) return forbidden()
    const { scheduleCode } = await params
    const result = await validatePayeSchedule(scheduleCode)
    return success(result)
  } catch (e) { console.error(e); return internalError() }
}
