import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success } from '@/lib/api'
import { PAGINATION_DEFAULT_PAGE, PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '@/lib/constants'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || String(PAGINATION_DEFAULT_PAGE)))
  const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULT_LIMIT))))
  const action = searchParams.get('action') || ''

  const where: Record<string, unknown> = {}
  if (action) where.action = action

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return success({ items: logs, total, page, limit, totalPages: Math.ceil(total / limit) })
}, 'audit.view')
