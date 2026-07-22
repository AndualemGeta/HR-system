import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentExportTemplate.view'))) return forbidden()
    const { id } = await params
    const template = await prisma.paymentExportTemplate.findUnique({ where: { id } })
    if (!template) return notFound()
    return success(template)
  } catch (e) { console.error(e); return internalError() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentExportTemplate.manage'))) return forbidden()
    const { id } = await params
    const existing = await prisma.paymentExportTemplate.findUnique({ where: { id } })
    if (!existing) return notFound()
    const body = await req.json().catch(() => ({}))
    const template = await prisma.paymentExportTemplate.update({
      where: { id },
      data: { ...body, version: existing.version + 1 },
    })
    return success(template)
  } catch (e) { console.error(e); return internalError() }
}
