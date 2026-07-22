import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const { searchParams } = new URL(req.url)
    const department = searchParams.get('department')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = { payrollPeriodId: id }
    if (department) where.department = department
    if (status) where.validationStatus = status
    if (search) {
      where.OR = [
        { employeeName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const rows = await prisma.mvpPayrollRow.findMany({
      where,
      orderBy: [{ employeeName: 'asc' }],
    })

    return success({ rows, total: rows.length })
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

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'DRAFT' && period.status !== 'READY') return badRequest('Period is locked')

    const body = await req.json().catch(() => ({}))
    const { rows } = body
    if (!rows || !Array.isArray(rows)) return badRequest('rows array is required')

    for (const row of rows) {
      if (!row.id) continue
      const updateData: Record<string, unknown> = {}
      const allowedFields = ['allowance', 'overtime', 'incentive', 'commission',
        'employeePension', 'incomeTax', 'otherDeduction', 'notes', 'basicSalary',
        'paymentMethod', 'bankName', 'bankAccountNumber', 'mpesaAccount']
      for (const field of allowedFields) {
        if (row[field] !== undefined) {
          updateData[field] = row[field] === '' ? null : row[field]
        }
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.mvpPayrollRow.update({ where: { id: row.id }, data: updateData })
      }
    }

    return success({ updated: rows.length })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
