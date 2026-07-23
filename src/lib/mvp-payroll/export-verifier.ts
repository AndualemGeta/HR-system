import ExcelJS from 'exceljs'
import Decimal from 'decimal.js'
import { ALL_REQUIRED_SHEETS, COLUMN_HEADERS_A_S } from './template-map'

export interface VerificationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sheetCount: number
  employeeCount: number
  totalGross: Decimal
  totalDeductions: Decimal
  totalNet: Decimal
  hasExternalLinks: boolean
}

interface ExpectedRow {
  employeeCode: string
  employeeName: string
  payrollGroup: string | null
  grossSalary: number
  totalDeduction: number
  netSalary: number
}

export async function verifyExport(
  filePath: string,
  expectedRows: ExpectedRow[]
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

  const expectedGross = expectedRows.reduce((s, r) => s.plus(r.grossSalary), new Decimal(0))
  const expectedDed = expectedRows.reduce((s, r) => s.plus(r.totalDeduction), new Decimal(0))
  const expectedNet = expectedRows.reduce((s, r) => s.plus(r.netSalary), new Decimal(0))

  let exportGross = new Decimal(0)
  let exportDed = new Decimal(0)
  let exportNet = new Decimal(0)

  for (const sheetName of payrollSheetNames) {
    if (!wsNames.includes(sheetName)) continue
    const ws = wb.getWorksheet(sheetName)
    if (!ws) continue

    const lastRow = ws.lastRow
    if (lastRow) {
      const g = new Decimal(Number(ws.getRow(lastRow.number).getCell(10).value || 0))
      const d = new Decimal(Number(ws.getRow(lastRow.number).getCell(16).value || 0))
      const n = new Decimal(Number(ws.getRow(lastRow.number).getCell(18).value || 0))
      exportGross = exportGross.plus(g)
      exportDed = exportDed.plus(d)
      exportNet = exportNet.plus(n)
    }
  }

  if (exportGross.minus(expectedGross).abs().gt(1)) {
    errors.push(`Gross total mismatch: export=${exportGross.toFixed(2)}, expected=${expectedGross.toFixed(2)}`)
  }
  if (exportDed.minus(expectedDed).abs().gt(1)) {
    errors.push(`Deduction total mismatch: export=${exportDed.toFixed(2)}, expected=${expectedDed.toFixed(2)}`)
  }
  if (exportNet.minus(expectedNet).abs().gt(1)) {
    errors.push(`Net total mismatch: export=${exportNet.toFixed(2)}, expected=${expectedNet.toFixed(2)}`)
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
