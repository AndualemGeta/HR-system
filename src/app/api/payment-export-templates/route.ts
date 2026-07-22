import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { z } from 'zod'

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  paymentMethod: z.enum(['BANK', 'MPESA', 'MANUAL', 'HOLD']),
  format: z.enum(['CSV', 'XLSX']),
  delimiter: z.string().default(','),
  hasHeader: z.boolean().default(true),
  dateFormat: z.string().default('YYYY-MM-DD'),
  amountFormat: z.string().default('0.00'),
  encoding: z.string().default('UTF-8'),
  columnConfigJson: z.string(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentExportTemplate.view'))) return forbidden()
    const templates = await prisma.paymentExportTemplate.findMany({ orderBy: { code: 'asc' } })
    return success(templates)
  } catch (e) { console.error(e); return internalError() }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'paymentExportTemplate.manage'))) return forbidden()
    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())
    const template = await prisma.paymentExportTemplate.create({
      data: { ...parsed.data, createdById: session.userId },
    })
    return success(template, 201)
  } catch (e) { console.error(e); return internalError() }
}
