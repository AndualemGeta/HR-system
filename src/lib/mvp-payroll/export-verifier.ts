import ExcelJS from 'exceljs'
import Decimal from 'decimal.js'
import { ALL_REQUIRED_SHEETS, WORKSHEET_NAMES, PAYROLL_SHEETS_MAP } from './template-map'
import type { ManifestEntry } from './excel-generator'

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

export interface ExpectedRow {
  employeeCode: string
  employeeName: string
  payrollGroup: string | null
  grossSalary: number
  totalDeduction: number
  netSalary: number
  basicSalary?: number
  workingDays?: number
  position?: string
  workplace?: string
  payrollRowId?: string
  employeeId?: string
}

interface SheetLayout {
  headerRow: number
  dataStartRow: number
  dataEndRow: number
  totalRow: number
}

function analyzeSheet(ws: ExcelJS.Worksheet): SheetLayout {
  let headerRow = 0
  let dataStartRow = 0
  let dataEndRow = 0
  let totalRow = 0

  for (let r = 1; r <= (ws.rowCount || 50); r++) {
    const cell1 = String(ws.getRow(r).getCell(1).value || '').trim().toLowerCase()
    const cell2 = String(ws.getRow(r).getCell(2).value || '').trim().toLowerCase()
    if (cell1 === 'no.' || cell1 === 'no' || cell1 === 'no:') {
      headerRow = r
      dataStartRow = r + 1
      continue
    }
    if (dataStartRow > 0 && cell2.startsWith('total')) {
      totalRow = r
      dataEndRow = r - 1
      break
    }
  }

  if (!headerRow) { headerRow = 3; dataStartRow = 4 }
  if (!totalRow) { totalRow = ws.rowCount; dataEndRow = totalRow - 1 }

  return { headerRow, dataStartRow, dataEndRow, totalRow }
}

function hasExternalLink(cell: ExcelJS.Cell): boolean {
  if (!cell.value) return false
  if (typeof cell.value === 'object' && 'sharedFormula' in cell.value) return true
  if (cell.text && /\[[\d]+\]/.test(cell.text)) return true
  if (typeof cell.value === 'object' && cell.value !== null) {
    const v = cell.value as unknown as Record<string, unknown>
    if (typeof v.formula === 'string' && /\[.*?\]/.test(v.formula)) return true
  }
  return false
}

function inspectExternalLink(wb: ExcelJS.Workbook): boolean {
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= (ws.rowCount || 0); r++) {
      const row = ws.getRow(r)
      if (!row) continue
      for (let c = 1; c <= (row.cellCount || 19); c++) {
        if (hasExternalLink(row.getCell(c))) return true
      }
    }
  }
  try {
    const wbAny = wb as unknown as Record<string, unknown>
    if (wbAny.workbook && typeof wbAny.workbook === 'object') {
      const wbk = wbAny.workbook as Record<string, unknown>
      if (wbk.relationships && Array.isArray(wbk.relationships)) {
        for (const rel of wbk.relationships) {
          const r = rel as Record<string, unknown>
          if (r.target && typeof r.target === 'string' && /\.xlsx?$/i.test(r.target)) return true
        }
      }
    }
  } catch {
    // ignore inspection errors
  }
  return false
}

function resolveCellValue(value: unknown): { formula?: string; numberValue?: number; stringValue?: string } {
  if (value === null || value === undefined) return {}
  if (typeof value === 'number') return { numberValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (typeof obj.formula === 'string') {
      return { formula: obj.formula, numberValue: typeof obj.result === 'number' ? obj.result : undefined }
    }
    if (typeof obj.result === 'number') return { numberValue: obj.result, formula: typeof obj.formula === 'string' ? String(obj.formula) : undefined }
    if (typeof obj.sharedFormula === 'string') return { formula: obj.sharedFormula }
  }
  return {}
}

function getFormulaString(totalCell: ExcelJS.Cell): string {
  const value = totalCell.value
  if (typeof value === 'object' && value !== null && 'formula' in value) {
    return String((value as { formula: string }).formula)
  }
  return String(value || '')
}

function extractRangeFromFormula(formula: string, colLetter: string): { firstRow: number; lastRow: number } | null {
  const regex = new RegExp(`${colLetter}(\\d+):${colLetter}(\\d+)`)
  const match = formula.match(regex)
  if (!match) return null
  return { firstRow: parseInt(match[1], 10), lastRow: parseInt(match[2], 10) }
}

export async function verifyExport(
  filePath: string,
  expectedRows: ExpectedRow[],
  manifest?: ManifestEntry[]
): Promise<VerificationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const wb = await new ExcelJS.Workbook().xlsx.readFile(filePath)
  const wsNames = wb.worksheets.map(ws => ws.name)

  if (wsNames.length !== ALL_REQUIRED_SHEETS.length) {
    errors.push(`Expected ${ALL_REQUIRED_SHEETS.length} worksheets, got ${wsNames.length}`)
  }

  for (const required of ALL_REQUIRED_SHEETS) {
    if (!wsNames.includes(required)) {
      errors.push(`Missing required worksheet: "${required}"`)
    }
  }

  for (const wsName of wsNames) {
    if (!ALL_REQUIRED_SHEETS.includes(wsName as typeof ALL_REQUIRED_SHEETS[number])) {
      errors.push(`Unexpected extra worksheet: "${wsName}"`)
    }
  }

  if (inspectExternalLink(wb)) {
    errors.push('Export contains external links or cross-workbook references — rejected')
  }

  const sheetLayouts: Record<string, SheetLayout> = {}
  for (const name of WORKSHEET_NAMES) {
    if (!wsNames.includes(name)) continue
    const ws = wb.getWorksheet(name)
    if (!ws) continue
    sheetLayouts[name] = analyzeSheet(ws)
  }

  const sheetEmployeeCounts: Record<string, number> = {}

  if (manifest && manifest.length > 0) {
    for (const entry of manifest) {
      if (!entry.sheetName) continue
      sheetEmployeeCounts[entry.sheetName] = (sheetEmployeeCounts[entry.sheetName] || 0) + 1
    }
  } else {
    for (const sheetName of WORKSHEET_NAMES) {
      if (!wsNames.includes(sheetName)) continue
      const ws = wb.getWorksheet(sheetName)
      if (!ws) continue
      const layout = sheetLayouts[sheetName]
      let count = 0
      for (let r = layout.dataStartRow; r <= layout.dataEndRow; r++) {
        const code = String(ws.getRow(r).getCell(1).value || '').trim()
        if (!code || isNaN(Number(code))) continue
        const name = String(ws.getRow(r).getCell(2).value || '').trim()
        if (!name || name.startsWith('Total')) continue
        count++
      }
      sheetEmployeeCounts[sheetName] = count
    }
  }

  let totalFound = 0
  if (manifest && manifest.length > 0) {
    const foundById = new Map<string, ManifestEntry>()

    for (const entry of manifest) {
      const key = entry.payrollRowId || entry.employeeId || ''
      if (!key) continue
      if (foundById.has(key)) {
        errors.push(`Employee payrollRowId "${key}" appears ${foundById.has(key) ? 'twice' : 'multiple times'} in manifest`)
      }
      foundById.set(key, entry)
      totalFound++
    }

    for (const expected of expectedRows) {
      const key = expected.payrollRowId || expected.employeeId || expected.employeeName

      const entry = manifest.find(m => {
        if (expected.payrollRowId && m.payrollRowId === expected.payrollRowId) return true
        if (expected.employeeId && m.employeeId === expected.employeeId) return true
        return false
      })

      if (!entry) {
        errors.push(`Employee "${expected.employeeName}" (${expected.employeeCode}) not found in manifest`)
        continue
      }

      const ws = wb.getWorksheet(entry.sheetName)
      if (!ws) {
        errors.push(`Sheet "${entry.sheetName}" from manifest not found in workbook`)
        continue
      }

      const row = ws.getRow(entry.worksheetRowNumber)

      const cellB = resolveCellValue(row.getCell(2).value)
      const cellC = resolveCellValue(row.getCell(3).value)
      const cellD = resolveCellValue(row.getCell(4).value)
      const cellE = resolveCellValue(row.getCell(5).value)
      const cellF = resolveCellValue(row.getCell(6).value)
      const cellJ = resolveCellValue(row.getCell(10).value)
      const cellP = resolveCellValue(row.getCell(16).value)
      const cellR = resolveCellValue(row.getCell(18).value)

      const actualName = (cellB.stringValue || '').trim()
      if (actualName !== expected.employeeName) {
        errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected name "${expected.employeeName}", got "${actualName}"`)
      }

      if (expected.position) {
        const actualPos = (cellC.stringValue || '').trim()
        if (actualPos && actualPos !== expected.position) {
          errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected position "${expected.position}", got "${actualPos}"`)
        }
      }

      if (expected.workplace) {
        const actualWp = (cellD.stringValue || '').trim()
        if (actualWp && actualWp !== expected.workplace) {
          errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected workplace "${expected.workplace}", got "${actualWp}"`)
        }
      }

      if (expected.workingDays !== undefined) {
        const actualWd = cellE.numberValue
        if (actualWd !== undefined && Math.abs(actualWd - expected.workingDays) > 0.5) {
          errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected workingDays ${expected.workingDays}, got ${actualWd}`)
        }
      }

      if (expected.basicSalary !== undefined) {
        const actualBs = cellF.numberValue
        if (actualBs !== undefined && Math.abs(actualBs - expected.basicSalary) > 0.5) {
          errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected basicSalary ${expected.basicSalary}, got ${actualBs}`)
        }
      }

      const actualGross = cellJ.numberValue
      if (actualGross !== undefined && Math.abs(actualGross - expected.grossSalary) > 1) {
        errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected grossSalary ${expected.grossSalary}, got ${actualGross}`)
      }

      const actualDed = cellP.numberValue
      if (actualDed !== undefined && Math.abs(actualDed - expected.totalDeduction) > 1) {
        errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected totalDeduction ${expected.totalDeduction}, got ${actualDed}`)
      }

      const actualNet = cellR.numberValue
      if (actualNet !== undefined && Math.abs(actualNet - expected.netSalary) > 1) {
        errors.push(`Employee "${expected.employeeName}" at "${entry.sheetName}" row ${entry.worksheetRowNumber}: expected netSalary ${expected.netSalary}, got ${actualNet}`)
      }

      if (expected.payrollGroup) {
        const expectedSheet = PAYROLL_SHEETS_MAP[expected.payrollGroup]
        if (expectedSheet && entry.sheetName !== expectedSheet) {
          errors.push(`Employee "${expected.employeeName}" found in sheet "${entry.sheetName}" but expected in "${expectedSheet}" based on payroll group "${expected.payrollGroup}"`)
        }
      }
    }

    if (totalFound !== expectedRows.length) {
      errors.push(`Employee count mismatch: export has ${totalFound} rows, expected ${expectedRows.length}`)
    }
  }

  const grossBySheet: Record<string, Decimal> = {}
  const dedBySheet: Record<string, Decimal> = {}
  const netBySheet: Record<string, Decimal> = {}

  for (const sheetName of WORKSHEET_NAMES) {
    if (!wsNames.includes(sheetName)) continue
    const ws = wb.getWorksheet(sheetName)
    if (!ws) continue
    const layout = sheetLayouts[sheetName]

    let sheetGross = new Decimal(0)
    let sheetDed = new Decimal(0)
    let sheetNet = new Decimal(0)

    for (let r = layout.dataStartRow; r <= layout.dataEndRow; r++) {
      const code = String(ws.getRow(r).getCell(1).value || '').trim()
      if (!code || isNaN(Number(code))) continue
      const name = String(ws.getRow(r).getCell(2).value || '').trim()
      if (!name || name.startsWith('Total')) continue

      const g = new Decimal(Number(ws.getRow(r).getCell(10).value || 0))
      const d = new Decimal(Number(ws.getRow(r).getCell(16).value || 0))
      const n = new Decimal(Number(ws.getRow(r).getCell(18).value || 0))
      sheetGross = sheetGross.plus(g)
      sheetDed = sheetDed.plus(d)
      sheetNet = sheetNet.plus(n)
    }

    grossBySheet[sheetName] = sheetGross
    dedBySheet[sheetName] = sheetDed
    netBySheet[sheetName] = sheetNet
  }

  const exportGross = Object.values(grossBySheet).reduce((s, v) => s.plus(v), new Decimal(0))
  const exportDed = Object.values(dedBySheet).reduce((s, v) => s.plus(v), new Decimal(0))
  const exportNet = Object.values(netBySheet).reduce((s, v) => s.plus(v), new Decimal(0))

  const expectedGross = expectedRows.reduce((s, r) => s.plus(r.grossSalary), new Decimal(0))
  const expectedDed = expectedRows.reduce((s, r) => s.plus(r.totalDeduction), new Decimal(0))
  const expectedNet = expectedRows.reduce((s, r) => s.plus(r.netSalary), new Decimal(0))

  if (exportGross.minus(expectedGross).abs().gt(1)) {
    errors.push(`Gross total mismatch: export=${exportGross.toFixed(2)}, expected=${expectedGross.toFixed(2)}`)
  }
  if (exportDed.minus(expectedDed).abs().gt(1)) {
    errors.push(`Deduction total mismatch: export=${exportDed.toFixed(2)}, expected=${expectedDed.toFixed(2)}`)
  }
  if (exportNet.minus(expectedNet).abs().gt(1)) {
    errors.push(`Net total mismatch: export=${exportNet.toFixed(2)}, expected=${expectedNet.toFixed(2)}`)
  }

  for (const sheetName of WORKSHEET_NAMES) {
    if (!wsNames.includes(sheetName)) continue
    if (!sheetEmployeeCounts[sheetName]) continue
    const layout = sheetLayouts[sheetName]
    if (layout.dataEndRow < layout.dataStartRow) continue

    const firstRow = layout.dataStartRow
    const lastRow = layout.dataEndRow
    const ws = wb.getWorksheet(sheetName)
    if (!ws) continue

    const totalRow = ws.getRow(layout.totalRow)

    const colsToCheck = ['J', 'P', 'R']
    for (const colLetter of colsToCheck) {
      const colNum = colLetter === 'J' ? 10 : colLetter === 'P' ? 16 : 18
      const formula = getFormulaString(totalRow.getCell(colNum))
      const range = extractRangeFromFormula(formula, colLetter)

      if (!range) {
        errors.push(`Sheet "${sheetName}" col ${colLetter}: total formula "${formula}" does not contain a valid SUM range`)
        continue
      }

      if (range.firstRow !== firstRow) {
        errors.push(`Sheet "${sheetName}" col ${colLetter}: total formula starts at row ${range.firstRow}, expected ${firstRow} (first employee row)`)
      }
      if (range.lastRow !== lastRow) {
        errors.push(`Sheet "${sheetName}" col ${colLetter}: total formula ends at row ${range.lastRow}, expected ${lastRow} (last employee row)`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sheetCount: wsNames.length,
    employeeCount: totalFound,
    totalGross: exportGross,
    totalDeductions: exportDed,
    totalNet: exportNet,
    hasExternalLinks: [...wsNames].some(n => {
      const ws = wb.getWorksheet(n)
      if (!ws) return false
      for (let r = 1; r <= (ws.rowCount || 0); r++) {
        for (let c = 1; c <= 19; c++) {
          if (hasExternalLink(ws.getRow(r).getCell(c))) return true
        }
      }
      return false
    }),
  }
}

function colToLetter(col: number): string {
  let s = ''
  while (col > 0) {
    col--
    s = String.fromCharCode(65 + (col % 26)) + s
    col = Math.floor(col / 26)
  }
  return s
}