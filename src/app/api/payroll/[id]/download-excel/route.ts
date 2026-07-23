import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { getExportDir } from '@/lib/mvp-payroll/template-map'
import fs from 'fs/promises'
import path from 'path'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const exportIdParam = searchParams.get('exportId')

    if (!exportIdParam) return NextResponse.json({ error: 'exportId query parameter is required' }, { status: 400 })

    const exportRecord = await prisma.mvpPayrollExport.findUnique({
      where: { id: exportIdParam },
    })
    if (!exportRecord) return NextResponse.json({ error: 'Export not found' }, { status: 404 })
    if (exportRecord.payrollPeriodId !== id) {
      return NextResponse.json({ error: 'Export does not belong to this period' }, { status: 400 })
    }

    const exportDir = getExportDir()
    const fileName = exportRecord.fileName

    const resolvedPath = path.resolve(path.join(exportDir, fileName))
    const resolvedDir = path.resolve(exportDir)
    const relative = path.relative(resolvedDir, resolvedPath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    try {
      await fs.access(resolvedPath)
    } catch {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    const fileBuffer = await fs.readFile(resolvedPath)

    await prisma.mvpPayrollExport.update({
      where: { id: exportRecord.id },
      data: { downloadedCount: { increment: 1 }, lastDownloadedAt: new Date() },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_EXPORT_DOWNLOAD',
      entityType: 'MvpPayrollExport',
      entityId: exportRecord.id,
      newValue: { payrollPeriodId: id, fileName },
    })

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
