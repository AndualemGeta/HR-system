import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from './session'
import { userHasPermission, type PermissionKey } from './rbac'

export interface ApiError {
  error: string
  details?: unknown
}

export function unauthorized(message = 'Unauthorized'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = 'Not found'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function badRequest(message: string, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function conflict(message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 409 })
}

export function internalError(message = 'Internal server error'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 500 })
}

export function success<T>(data: T, status = 200): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status })
}

export function withAuth(handler: (req: NextRequest, ctx: { userId: string; email: string; name: string; employeeId?: string | null }) => Promise<NextResponse>, requiredPermission?: PermissionKey) {
  return async (req: NextRequest) => {
    const session = await getSession()
    if (!session) return unauthorized()

    if (requiredPermission) {
      const hasPermission = await userHasPermission(session.userId, requiredPermission)
      if (!hasPermission) return forbidden()
    }

    const ctx = { userId: session.userId, email: session.email, name: session.name, employeeId: session.employeeId }

    try {
      return await handler(req, ctx)
    } catch (err) {
      console.error('API Error:', err instanceof Error ? err.message : err)
      return internalError()
    }
  }
}

export async function getBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return await req.json() as T
  } catch {
    return null
  }
}
