import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import {
  suggestFieldMapping, parseRow, validateRow,
  findExistingEmployee, type ImportRowData,
} from '@/lib/import-helpers'
import Papa from 'papaparse'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.import'))) return forbidden()

    const formData = await req.formData().catch(() => null)
    if (!formData) return badRequest('Form data required')

    const file = formData.get('file') as File | null
    const mappingStr = formData.get('mapping') as string | null
    const importMode = (formData.get('importMode') as string) || 'CREATE_OR_UPDATE'

    if (!file) return badRequest('File is required')
    if (!mappingStr) return badRequest('Column mapping is required')

    const fileName = file.name || 'upload.csv'
    if (importMode !== 'CREATE_ONLY' && importMode !== 'UPDATE_ONLY' && importMode !== 'CREATE_OR_UPDATE') {
      return badRequest('Invalid import mode. Use CREATE_ONLY, UPDATE_ONLY, or CREATE_OR_UPDATE')
    }

    const allowedTypes = ['.csv', '.xlsx', '.xls']
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
    if (!allowedTypes.includes(ext)) {
      return badRequest(`Unsupported file type: ${ext}. Accepted: CSV, XLSX, XLS`)
    }

    if (file.size > 10 * 1024 * 1024) {
      return badRequest('File too large. Maximum size is 10 MB')
    }

    let mapping: Record<string, string>
    try {
      mapping = JSON.parse(mappingStr)
    } catch {
      return badRequest('Invalid column mapping JSON')
    }

    let rawRows: Record<string, unknown>[] = []

    if (ext === '.csv') {
      const text = await file.text()
      const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() })
      if (result.errors.length > 0) {
        return badRequest(`CSV parse error: ${result.errors[0].message}`)
      }
      rawRows = result.data as Record<string, unknown>[]
    } else {
      try {
        const ExcelJS = await import('exceljs')
        const fileBytes = new Uint8Array(await file.arrayBuffer())
        const workbook = new ExcelJS.Workbook()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(fileBytes as any)
        const sheet = workbook.worksheets[0]
        if (!sheet || sheet.rowCount < 2) return badRequest('Excel file is empty or has no data rows')

        const headers: string[] = []
        sheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').trim()
        })

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return
          const rowData: Record<string, unknown> = {}
          row.eachCell((cell, colNumber) => {
            if (headers[colNumber]) {
              rowData[headers[colNumber]] = cell.value
            }
          })
          rawRows.push(rowData)
        })
      } catch {
        return badRequest('Failed to parse Excel file')
      }
    }

    if (rawRows.length === 0) {
      return badRequest('No data rows found in file')
    }

    const reverseMapping: Record<string, string> = {}
    for (const [sysField, csvCol] of Object.entries(mapping)) {
      reverseMapping[csvCol] = sysField
    }

    const allEmployeeIds = new Set((await prisma.employee.findMany({ select: { employeeId: true } })).map(e => e.employeeId))
    const allEmails = new Set((await prisma.employee.findMany({ where: { email: { not: null } }, select: { email: true } })).map(e => e.email!))
    const allPhones = new Set((await prisma.employee.findMany({ where: { phoneNumber: { not: null } }, select: { phoneNumber: true } })).map(e => e.phoneNumber!))

    const importRows: ImportRowData[] = []
    const validationResults: Array<{
      rowNumber: number
      status: string
      errors: string[]
      warnings: string[]
      matchedEmployeeId: string | null
      data: ImportRowData
    }> = []

    let validCount = 0, warningCount = 0, errorCount = 0, duplicateCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const rawRow = rawRows[i]
      const parsed = parseRow(rawRow, mapping)

      const matchedId = await findExistingEmployee(parsed)
      const result = await validateRow(parsed, i + 1, allEmployeeIds, allEmails, allPhones, importMode)
      result.matchedEmployeeId = matchedId

      if (matchedId) {
        if (importMode === 'CREATE_ONLY') {
          result.status = 'DUPLICATE'
          result.errors.push(`Employee already exists (matched: ${matchedId})`)
        }
      } else if (importMode === 'UPDATE_ONLY') {
        result.status = 'ERROR'
        result.errors.push('No matching employee found for update')
      }

      if (result.status === 'VALID') validCount++
      else if (result.status === 'WARNING') warningCount++
      else if (result.status === 'ERROR') errorCount++
      else if (result.status === 'DUPLICATE') duplicateCount++

      importRows.push(parsed)
      validationResults.push({
        rowNumber: i + 1,
        status: result.status,
        errors: result.errors,
        warnings: result.warnings,
        matchedEmployeeId: result.matchedEmployeeId,
        data: parsed,
      })
    }

    const session2 = await prisma.importSession.create({
      data: {
        fileName: file.name,
        importMode: importMode as never,
        status: 'PENDING',
        totalRows: rawRows.length,
        validRows: validCount,
        warningRows: warningCount,
        errorRows: errorCount,
        duplicateRows: duplicateCount,
        uploadedById: session.userId,
        metadata: { mapping, detectedColumns: Object.keys(rawRows[0] || {}) },
      },
    })

    for (const vr of validationResults) {
      await prisma.importRow.create({
        data: {
          sessionId: session2.id,
          rowNumber: vr.rowNumber,
          status: vr.status as never,
          errors: JSON.stringify(vr.errors),
          warnings: JSON.stringify(vr.warnings),
          matchedEmployeeId: vr.matchedEmployeeId,
          rawRow: rawRows[vr.rowNumber - 1] as never,
          parsedData: vr.data as never,
        },
      })
    }

    await createAuditLog({
      userId: session.userId,
      action: 'EMPLOYEE_IMPORT_PREVIEW',
      entityType: 'ImportSession',
      entityId: session2.id,
      newValue: {
        fileName: file.name,
        importMode,
        totalRows: rawRows.length,
        validRows: validCount,
        warningRows: warningCount,
        errorRows: errorCount,
        duplicateRows: duplicateCount,
      },
    })

    return success({
      importSessionId: session2.id,
      totalRows: rawRows.length,
      validRows: validCount,
      warningRows: warningCount,
      errorRows: errorCount,
      duplicateRows: duplicateCount,
      previewRows: validationResults.slice(0, 50),
      detectedColumns: Object.keys(rawRows[0] || {}),
      suggestedMappings: Object.fromEntries(
        Object.keys(rawRows[0] || {}).map(col => [col, suggestFieldMapping(col)])
      ),
    })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
