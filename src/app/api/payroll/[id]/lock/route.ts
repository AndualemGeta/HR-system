import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import Decimal from 'decimal.js'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.close'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({
      where: { id },
      include: { _count: { select: { rows: true } } },
    })
    if (!period) return notFound()
    if (period.status !== 'READY') return badRequest('Period must be READY before locking')

    const errorRows = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, validationStatus: 'ERROR' } })
    if (errorRows > 0) return badRequest(`Cannot lock: ${errorRows} row(s) have validation errors. Run validation first.`)

    const pendingRows = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, validationStatus: 'PENDING' } })
    if (pendingRows > 0) return badRequest(`Cannot lock: ${pendingRows} row(s) have not been validated. Run validation first.`)

    const exports = await prisma.mvpPayrollExport.findMany({
      where: { payrollPeriodId: id },
      orderBy: { generatedAt: 'desc' },
    })
    if (exports.length === 0) {
      return badRequest('Cannot lock: no successful Excel export exists. Generate export first.')
    }

    const latestExport = exports[0]
    const rowCount = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id } })

    if (latestExport.rowCount !== rowCount) {
      return badRequest(
        `Cannot lock: export row count (${latestExport.rowCount}) does not match payroll row count (${rowCount}). Regenerate export.`
      )
    }

    const rows = await prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id } })
    const payrollGross = rows.reduce((s, r) => s.plus(Number(r.grossSalary || 0)), new Decimal(0))
    const payrollDed = rows.reduce((s, r) => s.plus(Number(r.totalDeduction || 0)), new Decimal(0))
    const payrollNet = rows.reduce((s, r) => s.plus(Number(r.netSalary || 0)), new Decimal(0))

    const exportGross = new Decimal(Number(latestExport.totalGross || 0))
    const exportDed = new Decimal(Number(latestExport.totalDeductions || 0))
    const exportNet = new Decimal(Number(latestExport.totalNet || 0))

    if (exportGross.minus(payrollGross).abs().gt(1)) {
      return badRequest(`Cannot lock: export gross (${exportGross.toFixed(2)}) differs from payroll gross (${payrollGross.toFixed(2)}). Regenerate export.`)
    }
    if (exportDed.minus(payrollDed).abs().gt(1)) {
      return badRequest(`Cannot lock: export deductions (${exportDed.toFixed(2)}) differs from payroll deductions (${payrollDed.toFixed(2)}). Regenerate export.`)
    }
    if (exportNet.minus(payrollNet).abs().gt(1)) {
      return badRequest(`Cannot lock: export net (${exportNet.toFixed(2)}) differs from payroll net (${payrollNet.toFixed(2)}). Regenerate export.`)
    }

    const updated = await prisma.mvpPayrollPeriod.update({
      where: { id },
      data: { status: 'LOCKED', lockedById: session.userId, lockedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_PERIOD_LOCK', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { status: 'LOCKED', exportId: latestExport.id, rowCount, exportRowCount: latestExport.rowCount },
    })

    return success(updated)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
