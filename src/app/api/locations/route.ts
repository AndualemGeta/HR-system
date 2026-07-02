import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { success, unauthorized, internalError } from '@/lib/api'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const parentId = searchParams.get('parentId')

    const where: Record<string, unknown> = { isActive: true }
    if (type) where.type = type
    if (parentId) where.parentId = parentId

    const locations = await prisma.location.findMany({
      where,
      select: { id: true, name: true, code: true, type: true, parentId: true },
      orderBy: { name: 'asc' },
    })

    return success(locations)
  } catch (err) { console.error(err); return internalError() }
}
