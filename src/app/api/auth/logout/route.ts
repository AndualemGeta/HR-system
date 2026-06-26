import { NextResponse } from 'next/server'
import { clearSessionCookie, getSession } from '@/lib/session'
import { createAuditLog } from '@/lib/audit'

export async function POST() {
  const session = await getSession()
  if (session) {
    await createAuditLog({
      userId: session.userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: session.userId,
    })
  }
  await clearSessionCookie()
  return NextResponse.json({ data: { message: 'Logged out' } })
}
