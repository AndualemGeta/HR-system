import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getUserPermissions } from '@/lib/rbac'
import { unauthorized } from '@/lib/api'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const permissions = await getUserPermissions(session.userId)

  return NextResponse.json({
    data: {
      id: session.userId,
      email: session.email,
      name: session.name,
      employeeId: session.employeeId,
      permissions,
    },
  })
}
