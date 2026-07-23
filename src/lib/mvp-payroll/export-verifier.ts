import ExcelJS from 'exceljs'
import { ALL_REQUIRED_SHEETS, COLUMN_HEADERS_A_S } from './template-map'

export interface VerificationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sheetCount: number
  employeeCount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  hasExternalLinks: boolean
}

export async function verifyExport(
  filePath: string,
  expectedRows: Array<{
    employeeCode: string
    employeeName: string
    payrollGroup: string | null
    grossSalary: number
    totalDeduction: number
    netSalary: number
  }>
): Promise<VerificationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const wb = await new ExcelJS.Workbook().xlsx.readFile(filePath)

  const wsNames = wb.worksheets.map(ws => ws.name)

  for (const required of ALL_REQUIRED_SHEETS) {
    if (!wsNames.includes(required)) {
      errors.push(`Missing required worksheet: "${required}"`)
    }
  }

  const payrollSheetNames = ALL_REQUIRED_SHEETS.slice(0, 13)
  const foundEmployees = new Set<string>()
  const duplicateEmployees: string[] = []

  for (const sheetName of payrollSheetNames) {
    if (!wsNames.includes(sheetName)) continue
    const ws = wb.getWorksheet(sheetName)
    if (!ws) continue

    const headerCells: string[] = []
    const headerRow = ws.getRow(3)
    for (let c = 1; c <= 19; c++) {
      headerCells.push(String(headerRow.getCell(c).value || '').trim())
    }

    for (let i = 0; i < COLUMN_HEADERS_A_S.length; i++) {
      if (headerCells[i] !== COLUMN_HEADERS_A_S[i]) {
        errors.push(`Sheet "${sheetName}" column ${i + 1} header mismatch: expected "${COLUMN_HEADERS_A_S[i]}", got "${headerCells[i] || '(empty)'}"`)
      }
    }

    for (let r = 4; r <= ws.rowCount; r++) {
      const code = String(ws.getRow(r).getCell(1).value || '').trim()
      if (!code || /^[A-Z]+$/i.test(code)) continue

      const name = String(ws.getRow(r).getCell(2).value || '').trim()
      if (!name || name.startsWith('Total')) continue

      if (foundEmployees.has(name)) {
        duplicateEmployees.push(name)
      }
      foundEmployees.add(name)
    }
  }

  if (duplicateEmployees.length > 0) {
    errors.push(`Duplicate employees found across sheets: ${duplicateEmployees.join(', ')}`)
  }

  for (const expected of expectedRows) {
    if (!foundEmployees.has(expected.employeeName)) {
      errors.push(`Employee "${expected.employeeName}" (${expected.employeeCode}) not found in any payroll sheet`)
    }
  }

  if (foundEmployees.size !== expectedRows.length) {
    warnings.push(`Employee count mismatch: export has ${foundEmployees.size}, expected ${expectedRows.length}`)
  }

  const totalGross = expectedRows.reduce((s, r) => s + r.grossSalary, 0)
  const totalDeductions = expectedRows.reduce((s, r) => s + r.totalDeduction, 0)
  const totalNet = expectedRows.reduce((s, r) => s + r.netSalary, 0)

  let exportGross = 0
  let exportDed = 0
  let exportNet = 0

  for (const sheetName of payrollSheetNames) {
    if (!wsNames.includes(sheetName)) continue
    const ws = wb.getWorksheet(sheetName)
    if (!ws) continue

    const lastRow = ws.lastRow
    if (lastRow) {
      const g = Number(ws.getRow(lastRow.number).getCell(10).value || 0)
      const d = Number(ws.getRow(lastRow.number).getCell(16).value || 0)
      const n = Number(ws.getRow(lastRow.number).getCell(18).value || 0)
      exportGross += g
      exportDed += d
      exportNet += n
    }
  }

  if (Math.abs(exportGross - totalGross) > 1) {
    errors.push(`Gross total mismatch: export=${exportGross}, expected=${totalGross}`)
  }
  if (Math.abs(exportDed - totalDeductions) > 1) {
    errors.push(`Deduction total mismatch: export=${exportDed}, expected=${totalDeductions}`)
  }
  if (Math.abs(exportNet - totalNet) > 1) {
    errors.push(`Net total mismatch: export=${exportNet}, expected=${totalNet}`)
  }

  let hasExternalLinks = false
  for (const ws of wb.worksheets) {
    for (const row of ws.getRows(1, ws.rowCount) || []) {
      if (!row) continue
      for (let c = 1; c <= (row.cellCount || 19); c++) {
        const cell = row.getCell(c)
        if (cell.value && typeof cell.value === 'object' && 'sharedFormula' in cell.value) {
          hasExternalLinks = true
          warnings.push(`External link found in sheet "${ws.name}" row ${row.number} col ${c}`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sheetCount: wsNames.length,
    employeeCount: foundEmployees.size,
    totalGross: exportGross,
    totalDeductions: exportDed,
    totalNet: exportNet,
    hasExternalLinks,
  }
}
