import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { createSession, setSessionCookie } from '@/lib/session'
import { createAuditLog } from '@/lib/audit'
import { badRequest, unauthorized, internalError, success } from '@/lib/api'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) return unauthorized('Invalid email or password')

    if (user.lockedUntil && user.lockedUntil > new Date()) return unauthorized('Account is temporarily locked')

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      const newCount = user.failedLoginCount + 1
      const updates: Record<string, unknown> = { failedLoginCount: newCount }
      if (newCount >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
      }
      await prisma.user.update({ where: { id: user.id }, data: updates })

      await createAuditLog({
        userId: user.id,
        action: 'FAILED_LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      })

      return unauthorized('Invalid email or password')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    const token = await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      employeeId: user.employeeId,
    })
    await setSessionCookie(token)

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    })

    return success({ user: { id: user.id, email: user.email, name: user.name, employeeId: user.employeeId } })
  } catch (err) {
    console.error('Login error:', err)
    return internalError()
  }
}
