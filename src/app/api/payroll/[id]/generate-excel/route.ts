import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { generateExcel } from '@/lib/mvp-payroll/excel-generator'
import { verifyExport } from '@/lib/mvp-payroll/export-verifier'
import { getExportDir, TEMPLATE_VERSION } from '@/lib/mvp-payroll/template-map'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.close'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY' && period.status !== 'LOCKED') return badRequest('Period must be READY or LOCKED')

    const errorRows = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, validationStatus: 'ERROR' } })
    if (errorRows > 0) return badRequest(`Cannot export: ${errorRows} row(s) have validation errors. Fix blockers first.`)
    const pendingRows = await prisma.mvpPayrollRow.count({ where: { payrollPeriodId: id, validationStatus: 'PENDING' } })
    if (pendingRows > 0) return badRequest(`Cannot export: ${pendingRows} row(s) have not been validated. Run validation first.`)

    const rows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id },
      orderBy: [{ location: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
    })
    if (rows.length === 0) return badRequest('No rows to export')

    const exportDir = getExportDir()
    await fs.mkdir(exportDir, { recursive: true })

    const periodLabel = `${period.periodName} (${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]})`
    const fileName = `payroll_${period.periodName}_${Date.now()}.xlsx`
    const filePath = path.join(exportDir, fileName)

    const genError = (msg: string) => {
      createAuditLog({
        userId: session.userId, action: 'EXPORT_FAILED' as never, entityType: 'MvpPayrollPeriod',
        entityId: id, newValue: { error: msg, templateVersion: TEMPLATE_VERSION, timestamp: new Date().toISOString() },
      }).catch(() => {})
    }

    let result
    try {
      result = await generateExcel({
        rows: rows.map(r => r as unknown as Parameters<typeof generateExcel>[0]['rows'][number]),
        periodLabel,
        generatedById: session.userId,
        filePath,
      })
    } catch (err) {
      await fs.unlink(filePath).catch(() => {})
      const message = err instanceof Error ? err.message : String(err)
      genError(`Generate failed: ${message}`)
      return badRequest(message)
    }

    const verification = await verifyExport(filePath, rows.map(r => ({
      payrollRowId: r.id,
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      employeeName: r.employeeName,
      payrollGroup: r.payrollGroup as string | null,
      position: r.role || '',
      workplace: r.shop || r.location || r.department || '',
      workingDays: Number(r.workingDays || 0),
      basicSalary: Number(r.basicSalary || 0),
      grossSalary: Number(r.grossSalary || 0),
      totalDeduction: Number(r.totalDeduction || 0),
      netSalary: Number(r.netSalary || 0),
    })), result.manifest)

    if (!verification.valid) {
      await fs.unlink(filePath).catch(() => {})
      genError(`Verification failed: ${verification.errors.join('; ')}`)
      return badRequest(`Export verification failed: ${verification.errors.join('; ')}`)
    }

    const exportRecord = await prisma.mvpPayrollExport.create({
      data: {
        payrollPeriodId: id,
        fileName,
        format: 'XLSX',
        rowCount: result.rowCount,
        totalGross: result.totalGross,
        totalDeductions: result.totalDeductions,
        totalNet: result.totalNet,
        checksum: result.checksum,
        templateVersion: result.templateVersion,
        generatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId, action: 'EXPORT_CREATE', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: {
        fileName, rowCount: result.rowCount, checksum: result.checksum,
        templateVersion: result.templateVersion, verificationErrors: verification.errors.length,
        verificationWarnings: verification.warnings.length,
      },
    })

    return success({
      export: exportRecord,
      downloadUrl: `/api/payroll/${id}/download-excel?exportId=${exportRecord.id}`,
      verification: { errors: verification.errors, warnings: verification.warnings },
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}