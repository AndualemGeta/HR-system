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

interface ExpectedRow {
  employeeCode: string
  employeeName: string
  payrollGroup: string | null
  grossSalary: number
  totalDeduction: number
  netSalary: number
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

export async function verifyExport(
  filePath: string,
  expectedRows: ExpectedRow[],
  manifest?: ManifestEntry[]
): Promise<VerificationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const wb = await new ExcelJS.Workbook().xlsx.readFile(filePath)
  const wsNames = wb.worksheets.map(ws => ws.name)

  // Check exactly 13 sheets (11 payroll + 2 supporting)
  if (wsNames.length !== ALL_REQUIRED_SHEETS.length) {
    errors.push(`Expected ${ALL_REQUIRED_SHEETS.length} worksheets, got ${wsNames.length}`)
  }

  for (const required of ALL_REQUIRED_SHEETS) {
    if (!wsNames.includes(required)) {
      errors.push(`Missing required worksheet: "${required}"`)
    }
  }

  // Check for extra sheets
  for (const wsName of wsNames) {
    if (!ALL_REQUIRED_SHEETS.includes(wsName as typeof ALL_REQUIRED_SHEETS[number])) {
      errors.push(`Unexpected extra worksheet: "${wsName}"`)
    }
  }

  // External link check — hard reject
  if (inspectExternalLink(wb)) {
    errors.push('Export contains external links or cross-workbook references — rejected')
  }

  // Build layout for each payroll sheet
  const sheetLayouts: Record<string, SheetLayout> = {}
  for (const name of WORKSHEET_NAMES) {
    if (!wsNames.includes(name)) continue
    const ws = wb.getWorksheet(name)
    if (!ws) continue
    sheetLayouts[name] = analyzeSheet(ws)
  }

  // Verify each expected row via manifest or direct check
  const foundByName = new Map<string, { sheet: string; row: number }[]>()
  const sheetEmployeeCounts: Record<string, number> = {}

  if (manifest && manifest.length > 0) {
    // Use manifest for precise verification
    for (const entry of manifest) {
      if (!entry.sheetName || !entry.employeeName) continue
      const key = entry.employeeName
      if (!foundByName.has(key)) foundByName.set(key, [])
      foundByName.get(key)!.push({ sheet: entry.sheetName, row: entry.worksheetRowNumber })
      sheetEmployeeCounts[entry.sheetName] = (sheetEmployeeCounts[entry.sheetName] || 0) + 1
    }
  } else {
    // Fallback: scan worksheets directly
    for (const sheetName of WORKSHEET_NAMES) {
      if (!wsNames.includes(sheetName)) continue
      const ws = wb.getWorksheet(sheetName)
      if (!ws) continue
      const layout = sheetLayouts[sheetName]

      for (let r = layout.dataStartRow; r <= layout.dataEndRow; r++) {
        const code = String(ws.getRow(r).getCell(1).value || '').trim()
        if (!code || isNaN(Number(code))) continue
        const name = String(ws.getRow(r).getCell(2).value || '').trim()
        if (!name || name.startsWith('Total')) continue

        const key = name
        if (!foundByName.has(key)) foundByName.set(key, [])
        foundByName.get(key)!.push({ sheet: sheetName, row: r })
        sheetEmployeeCounts[sheetName] = (sheetEmployeeCounts[sheetName] || 0) + 1
      }
    }
  }

  // Verify every expected employee appears exactly once on the right sheet
  for (const expected of expectedRows) {
    const hits = foundByName.get(expected.employeeName)
    if (!hits || hits.length === 0) {
      errors.push(`Employee "${expected.employeeName}" (${expected.employeeCode}) not found in any payroll sheet`)
      continue
    }
    if (hits.length > 1) {
      errors.push(`Employee "${expected.employeeName}" (${expected.employeeCode}) appears ${hits.length} times across sheets`)
    }
    if (expected.payrollGroup) {
      const expectedSheet = PAYROLL_SHEETS_MAP[expected.payrollGroup]
      if (expectedSheet && hits[0].sheet !== expectedSheet) {
        errors.push(`Employee "${expected.employeeName}" found in sheet "${hits[0].sheet}" but expected in "${expectedSheet}" based on payroll group "${expected.payrollGroup}"`)
      }
    }
  }

  // Employee count mismatch is an ERROR
  const totalFound = [...foundByName.values()].reduce((s, v) => s + v.length, 0)
  if (totalFound !== expectedRows.length) {
    errors.push(`Employee count mismatch: export has ${totalFound} rows, expected ${expectedRows.length}`)
  }

  // Check for rows on wrong sheet (not assigned to any group)
  // This is covered by the manifest check above

  // Sum numeric values independently from columns J(10), P(16), R(18)
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

  // Verify total-row formulas cover first through last employee
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
    const totalFormula = String(totalRow.getCell(10).value || '')
    if (totalFormula.includes(`${colToLetter(10)}${firstRow}:${colToLetter(10)}${lastRow}`)) {
      // correct
    } else {
      errors.push(`Sheet "${sheetName}" total formula range ${totalFormula} does not cover first(${firstRow}) to last(${lastRow}) employee row`)
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
