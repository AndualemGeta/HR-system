import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createChangeRequest, isSensitiveField } from '@/lib/change-requests'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'changeRequest.view'))) return forbidden()

    const { searchParams } = new URL(req.url)
    const where: Record<string, unknown> = {}
    if (searchParams.get('status')) where.status = searchParams.get('status')
    if (searchParams.get('employeeId')) where.employeeId = searchParams.get('employeeId')
    if (searchParams.get('requestedField')) where.requestedField = searchParams.get('requestedField')

    const requests = await prisma.employeeProfileChangeRequest.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return success(requests)
  } catch { return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'changeRequest.create'))) return forbidden()

    const body = await req.json()
    const { employeeId, requestedField, oldValue, newValue, reason } = body
    if (!employeeId || !requestedField || newValue === undefined) return badRequest('employeeId, requestedField, and newValue are required')
    if (!isSensitiveField(requestedField)) return badRequest(`${requestedField} is not a sensitive field`)

    const request = await createChangeRequest({ employeeId, requestedField, oldValue: oldValue ?? null, newValue: String(newValue), reason, requestedById: session.userId })
    return success(request, 201)
  } catch { return internalError() }
}
