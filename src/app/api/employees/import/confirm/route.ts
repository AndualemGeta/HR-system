import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { createEmployeeFromImport, updateEmployeeFromImport, type ImportRowData } from '@/lib/import-helpers'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.importConfirm'))) return forbidden()

    const body = await req.json().catch(() => ({}))
    const { importSessionId, confirmed } = body

    if (!importSessionId) return badRequest('Import session ID is required')
    if (confirmed !== true) return badRequest('Confirmation is required. Set confirmed: true')

    const importSession = await prisma.importSession.findUnique({
      where: { id: importSessionId },
      include: { rows: { orderBy: { rowNumber: 'asc' } } },
    })
    if (!importSession) return notFound('Import session not found')
    if (importSession.status !== 'PENDING') return badRequest('Import session is not in pending status')

    await prisma.importSession.update({
      where: { id: importSessionId },
      data: { status: 'PROCESSING' },
    })

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0
    const createdEmployeeIds: string[] = []
    const updatedEmployeeIds: string[] = []

    const importableRows = importSession.rows.filter(r => r.status === 'VALID' || r.status === 'WARNING')

    for (const row of importableRows) {
      try {
        const parsedData = (row.parsedData || {}) as ImportRowData

        if (row.matchedEmployeeId && (importSession.importMode === 'UPDATE_ONLY' || importSession.importMode === 'CREATE_OR_UPDATE')) {
          await updateEmployeeFromImport(parsedData, row.matchedEmployeeId, session.userId)
          updatedCount++
          updatedEmployeeIds.push(row.matchedEmployeeId)
          await prisma.importRow.update({ where: { id: row.id }, data: { status: 'VALID' } })
        } else if (!row.matchedEmployeeId && (importSession.importMode === 'CREATE_ONLY' || importSession.importMode === 'CREATE_OR_UPDATE')) {
          const empId = await createEmployeeFromImport(parsedData, session.userId)
          if (empId) {
            createdCount++
            createdEmployeeIds.push(empId)
            await prisma.importRow.update({ where: { id: row.id }, data: { status: 'VALID' } })
          } else {
            skippedCount++
            await prisma.importRow.update({ where: { id: row.id }, data: { status: 'SKIPPED' } })
          }
        } else {
          skippedCount++
          await prisma.importRow.update({ where: { id: row.id }, data: { status: 'SKIPPED' } })
        }
      } catch {
        skippedCount++
        await prisma.importRow.update({ where: { id: row.id }, data: { status: 'SKIPPED' } })
      }
    }

    await prisma.importSession.update({
      where: { id: importSessionId },
      data: {
        status: 'COMPLETED',
        createdCount,
        updatedCount,
        skippedCount,
        completedAt: new Date(),
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'EMPLOYEE_IMPORT_CONFIRM',
      entityType: 'ImportSession',
      entityId: importSessionId,
      newValue: {
        importMode: importSession.importMode,
        totalRows: importSession.totalRows,
        createdCount,
        updatedCount,
        skippedCount,
        createdEmployeeIds,
        updatedEmployeeIds,
      },
    })

    return success({
      importSessionId,
      status: 'COMPLETED',
      createdCount,
      updatedCount,
      skippedCount,
      errorRows: importSession.errorRows,
      duplicateRows: importSession.duplicateRows,
      createdEmployeeIds,
      updatedEmployeeIds,
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
