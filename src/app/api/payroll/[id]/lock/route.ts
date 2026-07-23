import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

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

    // Require at least one successful export
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

    // Verify export totals match payroll totals
    const [rows] = await Promise.all([
      prisma.mvpPayrollRow.findMany({ where: { payrollPeriodId: id } }),
    ])
    const payrollGross = rows.reduce((s, r) => s + Number(r.grossSalary || 0), 0)
    const payrollDed = rows.reduce((s, r) => s + Number(r.totalDeduction || 0), 0)
    const payrollNet = rows.reduce((s, r) => s + Number(r.netSalary || 0), 0)

    const exportGross = Number(latestExport.totalGross || 0)
    const exportDed = Number(latestExport.totalDeductions || 0)
    const exportNet = Number(latestExport.totalNet || 0)

    if (Math.abs(exportGross - payrollGross) > 1) {
      return badRequest(`Cannot lock: export gross (${exportGross}) differs from payroll gross (${payrollGross}). Regenerate export.`)
    }
    if (Math.abs(exportDed - payrollDed) > 1) {
      return badRequest(`Cannot lock: export deductions (${exportDed}) differs from payroll deductions (${payrollDed}). Regenerate export.`)
    }
    if (Math.abs(exportNet - payrollNet) > 1) {
      return badRequest(`Cannot lock: export net (${exportNet}) differs from payroll net (${payrollNet}). Regenerate export.`)
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
