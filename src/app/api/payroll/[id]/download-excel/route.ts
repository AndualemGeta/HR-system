import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, internalError } from '@/lib/api'
import fs from 'fs/promises'
import path from 'path'

const EXPORT_DIR = path.join(process.cwd(), 'uploads', 'payroll-exports')

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.view'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const fileName = searchParams.get('file')
    if (!fileName) return NextResponse.json({ error: 'File parameter required' }, { status: 400 })

    const filePath = path.join(EXPORT_DIR, fileName)

    // Security: ensure file is within export directory
    const resolvedPath = path.resolve(filePath)
    const resolvedDir = path.resolve(EXPORT_DIR)
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await fs.readFile(filePath)

    // Update download counter
    await prisma.mvpPayrollExport.updateMany({
      where: { fileName, payrollPeriodId: id },
      data: { downloadedCount: { increment: 1 } },
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
