import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { isValidPayrollGroup } from '@/lib/payroll-group'

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
    if (period.status === 'LOCKED') return badRequest('Period is LOCKED. Reopen to DRAFT before editing rows.')

    // Row edits after READY are rejected — user must reopen to DRAFT first
    if (period.status === 'READY') return badRequest('Period is READY. Reopen to DRAFT before editing rows.')

    const body = await req.json().catch(() => ({}))
    const { rows } = body
    if (!rows || !Array.isArray(rows)) return badRequest('rows array is required')

    for (const row of rows) {
      if (!row.id) continue
      const updateData: Record<string, unknown> = {}
      const allowedFields = ['allowance', 'overtime', 'incentive', 'commission',
        'employeePension', 'incomeTax', 'otherDeduction', 'notes', 'basicSalary',
        'workingDays', 'payrollGroup',
        'paymentMethod', 'bankName', 'bankAccountNumber', 'mpesaAccount',
        'taxId', 'pensionId', 'region', 'area', 'shop']
      for (const field of allowedFields) {
        if (row[field] !== undefined) {
          if (field === 'payrollGroup' && row[field] !== null) {
            if (!isValidPayrollGroup(String(row[field]))) {
              return badRequest(`Invalid payroll group: "${row[field]}". Accepted: HO_AA_SHOP, DSA, EBU_DEPARTMENT, ALELETU, CHACHA, LEGETAFO, HMARIAM, SIRTI, MENDIDA, SENDAFA, SHENO`)
            }
          }
          updateData[field] = row[field] === '' ? null : row[field]
        }
      }
      if (Object.keys(updateData).length > 0) {
        // Any edit resets validation to PENDING
        updateData.validationStatus = 'PENDING'

        const existing = await prisma.mvpPayrollRow.findUnique({ where: { id: row.id } })
        await prisma.mvpPayrollRow.update({ where: { id: row.id }, data: updateData })

        const oldValues = existing
          ? Object.fromEntries(
              Object.entries(updateData)
                .filter(([k]) => k !== 'validationStatus')
                .map(([k]) => [k, existing[k as keyof typeof existing]])
            )
          : undefined

        await createAuditLog({
          userId: session.userId,
          action: 'PAYROLL_ROW_UPDATE',
          entityType: 'MvpPayrollRow',
          entityId: row.id,
          oldValue: oldValues,
          newValue: Object.fromEntries(
            Object.entries(updateData).filter(([k]) => k !== 'validationStatus')
          ),
        })
      }
    }

    return success({ updated: rows.length })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
