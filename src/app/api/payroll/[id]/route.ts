import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({
      where: { id },
      include: { _count: { select: { rows: true } } },
    })
    if (!period) return notFound()

    return success(period)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.update'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const { payDate } = body

    const existing = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!existing) return notFound()
    if (existing.status !== 'DRAFT') return forbidden('Only draft periods can be edited')

    const period = await prisma.mvpPayrollPeriod.update({
      where: { id },
      data: { payDate: payDate ? new Date(payDate) : undefined },
    })

    return success(period)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
