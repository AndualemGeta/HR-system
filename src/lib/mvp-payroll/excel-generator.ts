import ExcelJS from 'exceljs'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import Decimal from 'decimal.js'
import { computePayroll } from './calculation'
import {
  WORKSHEET_NAMES,
  SUMMARY_SHEET,
  OVERTIME_SHEET,
  PAYROLL_SHEETS_MAP,
  COLUMN_HEADERS_A_S,
  TEMPLATE_PATH,
  TEMPLATE_VERSION,
} from './template-map'
import type { MvpPayrollRow } from '@prisma/client'

export interface SheetMapEntry {
  sheetName: string
  headerRow: number
  dataStartRow: number
  totalRow: number
  titleRow: number
  approvalStartRow: number
}

function analyzeWorksheet(ws: ExcelJS.Worksheet): SheetMapEntry {
  let headerRow = 0
  let dataStartRow = 0
  let totalRow = 0
  let approvalStartRow = 0

  for (let r = 1; r <= (ws.rowCount || 100); r++) {
    const cell1 = String(ws.getRow(r).getCell(1).value || '').trim().toLowerCase()
    const cell2 = String(ws.getRow(r).getCell(2).value || '').trim().toLowerCase()
    if (cell1 === 'no.' || cell1 === 'no' || cell1 === 'no:') {
      headerRow = r
      dataStartRow = r + 1
      continue
    }
    if (dataStartRow > 0 && cell2.startsWith('total')) {
      totalRow = r
      dataStartRow = 0
      continue
    }
  }

  if (totalRow > 0) {
    for (let r = totalRow + 1; r <= (ws.rowCount || 100); r++) {
      const cell2 = String(ws.getRow(r).getCell(2).value || '').trim().toLowerCase()
      if (cell2.startsWith('prepared') || cell2.startsWith('approved') || cell2.startsWith('authorized') || cell2.startsWith('signature') || cell2.startsWith('hr') || cell2.startsWith('finance') || cell2.startsWith('general manager') || cell2.startsWith('gm')) {
        if (!approvalStartRow) approvalStartRow = r
        break
      }
    }
  }

  if (!headerRow) headerRow = 3

  return { sheetName: ws.name, headerRow, dataStartRow: headerRow + 1, totalRow, titleRow: 1, approvalStartRow }
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

export interface ManifestEntry {
  payrollRowId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  payrollGroup: string
  sheetName: string
  worksheetRowNumber: number
}

export interface GenerateExcelOptions {
  rows: Partial<MvpPayrollRow>[]
  periodLabel: string
  generatedById: string
  filePath: string
}

export interface GenerateExcelResult {
  fileName: string
  rowCount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  checksum: string
  templateVersion: string
  sheetCount: number
  sheetNames: string[]
  manifest: ManifestEntry[]
}

function buildRowValues(row: Partial<MvpPayrollRow>, no: number): (string | number)[] {
  const basic = Number(row.basicSalary || 0)
  const workingDays = Number(row.workingDays || 30)
  const commission = Number(row.commission || 0)
  const overtime = Number(row.overtime || 0)
  const kpi = Number(row.incentive || 0)
  const allowance = Number(row.allowance || 0)
  const shortageLoan = Number(row.otherDeduction || 0)

  let monthlySalary = Number(row.monthlySalary || 0)
  let grossSalary = Number(row.grossSalary || 0)
  let taxableIncome = Number(row.taxableIncome || 0)
  let incomeTax = Number(row.incomeTax || 0)
  let employeePension = Number(row.employeePension || 0)
  let employerPension = Number(row.employerPension || 0)
  let totalDeduction = Number(row.totalDeduction || 0)
  let netSalary = Number(row.netSalary || 0)

  if (!monthlySalary || !grossSalary || !netSalary) {
    const result = computePayroll({
      basicSalary: basic, workingDays, commission, overtime,
      incentive: kpi, allowance, otherDeduction: shortageLoan,
      pensionEligible: row.pensionEligible === true,
    })
    monthlySalary = monthlySalary || result.monthlySalary
    grossSalary = grossSalary || result.grossSalary
    taxableIncome = taxableIncome || result.taxableIncome
    incomeTax = incomeTax || result.incomeTax
    employeePension = employeePension || result.employeePension
    employerPension = employerPension || result.employerPension
    totalDeduction = totalDeduction || result.totalDeduction
    netSalary = netSalary || result.netSalary
  }

  return [
    no, row.employeeName || '', row.role || '',
    row.shop || row.location || row.department || '',
    workingDays, basic, monthlySalary, commission + overtime, kpi,
    grossSalary, taxableIncome, incomeTax,
    employeePension, employerPension, shortageLoan,
    totalDeduction, allowance, netSalary, '',
  ]
}

interface CapturedStyle {
  height?: number
  cells: { numFmt?: string; font?: Record<string, unknown>; fill?: Record<string, unknown>; border?: Record<string, unknown>; alignment?: Record<string, unknown> }[]
}

function captureRowStyle(row: ExcelJS.Row): CapturedStyle {
  const cells: CapturedStyle['cells'] = []
  for (let c = 1; c <= 19; c++) {
    const cell = row.getCell(c)
    cells.push({
      numFmt: cell.numFmt,
      font: cell.font ? ({ ...cell.font } as Record<string, unknown>) : undefined,
      fill: cell.fill ? ({ ...cell.fill } as Record<string, unknown>) : undefined,
      border: cell.border ? ({ ...cell.border } as Record<string, unknown>) : undefined,
      alignment: cell.alignment ? ({ ...cell.alignment } as Record<string, unknown>) : undefined,
    })
  }
  return { height: row.height, cells }
}

function applyCapturedStyle(target: ExcelJS.Row, style: CapturedStyle): void {
  if (style.height) target.height = style.height
  for (let c = 0; c < style.cells.length && c < 19; c++) {
    const cell = target.getCell(c + 1)
    const src = style.cells[c]
    if (src.numFmt) cell.numFmt = src.numFmt
    if (src.font) cell.font = src.font as unknown as ExcelJS.Font
    if (src.fill) cell.fill = src.fill as unknown as ExcelJS.Fill
    if (src.border) cell.border = src.border as unknown as Partial<ExcelJS.Borders>
    if (src.alignment) cell.alignment = src.alignment as unknown as Partial<ExcelJS.Alignment>
  }
}

function verifyHeaders(ws: ExcelJS.Worksheet): void {
  const wsName = ws.name
  if (!WORKSHEET_NAMES.includes(wsName as typeof WORKSHEET_NAMES[number])) return

  const map = analyzeWorksheet(ws)
  if (!map.headerRow) {
    throw new Error(`Template sheet "${wsName}" has no identifiable header row — cannot verify headers`)
  }

  const headerRow = ws.getRow(map.headerRow)
  for (let c = 0; c < COLUMN_HEADERS_A_S.length; c++) {
    const expectedHeader = COLUMN_HEADERS_A_S[c]
    const cellValue = String(headerRow.getCell(c + 1).value || '').trim()
    if (cellValue !== expectedHeader) {
      throw new Error(`Template sheet "${wsName}" header column ${colToLetter(c + 1)}: expected "${expectedHeader}", got "${cellValue || '(empty)'}"`)
    }
  }
}

function verifyTemplate(wb: ExcelJS.Workbook): void {
  const wsNames = wb.worksheets.map(ws => ws.name)
  for (const name of WORKSHEET_NAMES) {
    if (!wsNames.includes(name)) {
      throw new Error(`Template missing required worksheet: "${name}"`)
    }
  }
  for (const ws of wb.worksheets) {
    if (WORKSHEET_NAMES.includes(ws.name as typeof WORKSHEET_NAMES[number])) {
      verifyHeaders(ws)
    }
  }
}

function buildSupportingSheets(wb: ExcelJS.Workbook, rows: Partial<MvpPayrollRow>[], periodLabel: string): void {
  const summary = wb.getWorksheet(SUMMARY_SHEET)
  if (summary) {
    const headerStyle = captureRowStyle(summary.getRow(1))

    summary.getRow(1).getCell(1).value = `Performance Summary - ${periodLabel}`
    applyCapturedStyle(summary.getRow(1), headerStyle)

    const dataStyle = captureRowStyle(summary.getRow(3))

    const dataRows: { name: string; group: string; gross: number; ded: number; net: number }[] = []
    for (const row of rows) {
      dataRows.push({
        name: row.employeeName || '',
        group: row.payrollGroup || '',
        gross: Number(row.grossSalary || 0),
        ded: Number(row.totalDeduction || 0),
        net: Number(row.netSalary || 0),
      })
    }

    const existingDataEnd = summary.rowCount
    const dataStart = 3
    const rowsToRemove = existingDataEnd - dataStart + 1
    if (rowsToRemove > 0) summary.spliceRows(dataStart, rowsToRemove)

    let r = dataStart
    for (const d of dataRows) {
      const row = summary.getRow(r)
      applyCapturedStyle(row, dataStyle)
      row.getCell(1).value = d.name
      row.getCell(2).value = d.group
      row.getCell(3).value = d.gross
      row.getCell(4).value = d.ded
      row.getCell(5).value = d.net
      for (let c = 3; c <= 5; c++) row.getCell(c).numFmt = '#,##0.00'
      r++
    }

    const totalRow = summary.getRow(r)
    applyCapturedStyle(totalRow, dataStyle)
    totalRow.getCell(1).value = 'TOTAL'
    totalRow.getCell(1).font = { bold: true }
    if (dataRows.length > 0) {
      totalRow.getCell(3).value = { formula: `SUM(C${dataStart}:C${r - 1})` }
      totalRow.getCell(4).value = { formula: `SUM(D${dataStart}:D${r - 1})` }
      totalRow.getCell(5).value = { formula: `SUM(E${dataStart}:E${r - 1})` }
    } else {
      totalRow.getCell(3).value = 0
      totalRow.getCell(4).value = 0
      totalRow.getCell(5).value = 0
    }
    for (let c = 3; c <= 5; c++) {
      totalRow.getCell(c).numFmt = '#,##0.00'
      totalRow.getCell(c).font = { bold: true }
    }
  }

  const overtime = wb.getWorksheet(OVERTIME_SHEET)
  if (overtime) {
    const headerStyle = captureRowStyle(overtime.getRow(1))

    overtime.getRow(1).getCell(1).value = `Overtime Report - ${periodLabel}`
    applyCapturedStyle(overtime.getRow(1), headerStyle)

    const dataStyle = captureRowStyle(overtime.getRow(3))

    const otRows: { name: string; group: string; hours: number; amount: number }[] = []
    for (const row of rows) {
      const otValue = Number(row.overtime || 0)
      otRows.push({
        name: row.employeeName || '',
        group: row.payrollGroup || '',
        hours: otValue > 0 ? otValue / (Number(row.basicSalary || 1) / 30 / 8) : 0,
        amount: otValue,
      })
    }

    const existingDataEnd = overtime.rowCount
    const dataStart = 3
    const rowsToRemove = existingDataEnd - dataStart + 1
    if (rowsToRemove > 0) overtime.spliceRows(dataStart, rowsToRemove)

    let r = dataStart
    for (const d of otRows) {
      const row = overtime.getRow(r)
      applyCapturedStyle(row, dataStyle)
      row.getCell(1).value = d.name
      row.getCell(2).value = d.group
      row.getCell(3).value = d.hours
      row.getCell(4).value = d.amount
      row.getCell(4).numFmt = '#,##0.00'
      r++
    }

    const totalRow = overtime.getRow(r)
    applyCapturedStyle(totalRow, dataStyle)
    totalRow.getCell(1).value = 'TOTAL'
    totalRow.getCell(1).font = { bold: true }
    if (otRows.length > 0) {
      totalRow.getCell(4).value = { formula: `SUM(D${dataStart}:D${r - 1})` }
    } else {
      totalRow.getCell(4).value = 0
    }
    totalRow.getCell(4).numFmt = '#,##0.00'
    totalRow.getCell(4).font = { bold: true }
  }
}

function captureMergedCells(ws: ExcelJS.Worksheet, startRow: number, endRow: number): string[] {
  const ranges: string[] = []
  try {
    const mc = (ws as unknown as { model?: { merges?: { range: string }[] } }).model?.merges
    if (mc) {
      for (const m of mc) {
        const match = m.range.match(/^(\$?[A-Z]+)\$?(\d+):(\$?[A-Z]+)\$?(\d+)$/)
        if (match) {
          const r1 = parseInt(match[2], 10)
          const r2 = parseInt(match[4], 10)
          if (r1 >= startRow && r2 <= endRow) ranges.push(m.range)
        }
      }
    }
  } catch {
    // ignore
  }
  return ranges
}

export async function generateExcel(opts: GenerateExcelOptions): Promise<GenerateExcelResult> {
  const { rows, periodLabel, filePath } = opts

  let templateWb: ExcelJS.Workbook
  try {
    templateWb = await new ExcelJS.Workbook().xlsx.readFile(TEMPLATE_PATH)
  } catch (err) {
    throw new Error(`Cannot read company payroll template at ${TEMPLATE_PATH}. Export failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  verifyTemplate(templateWb)

  const sheetGroups: Record<string, typeof rows> = {}
  for (const row of rows) {
    const pg = row.payrollGroup as string | null
    if (!pg) throw new Error(`Employee "${row.employeeName}" (${row.employeeCode}) has no payroll group — cannot assign to a worksheet`)
    const sheetName = PAYROLL_SHEETS_MAP[pg]
    if (!sheetName) throw new Error(`Unsupported payroll group "${pg}" for employee "${row.employeeName}" — cannot assign to a worksheet`)
    if (!sheetGroups[sheetName]) sheetGroups[sheetName] = []
    sheetGroups[sheetName].push(row)
  }

  const manifest: ManifestEntry[] = []

  for (const ws of templateWb.worksheets) {
    const name = ws.name
    if (!WORKSHEET_NAMES.includes(name as typeof WORKSHEET_NAMES[number])) continue

    const sheetMap = analyzeWorksheet(ws)
    const dataRows = sheetGroups[name] || []

    const referenceRowNum = sheetMap.dataStartRow
    const oldTotalRow = sheetMap.totalRow

    const refRow = ws.getRow(referenceRowNum)
    const capturedEmployeeStyle = captureRowStyle(refRow)

    const mergedCellRanges: string[] = []
    if (oldTotalRow > 0) {
      const totalSectionMerged = captureMergedCells(ws, oldTotalRow, oldTotalRow)
      mergedCellRanges.push(...totalSectionMerged)
    }
    if (sheetMap.approvalStartRow > 0) {
      const approvalMerged = captureMergedCells(ws, sheetMap.approvalStartRow, ws.rowCount)
      mergedCellRanges.push(...approvalMerged)
    }

    const approvalSection: { startRow: number; rowData: CapturedStyle[] } | null =
      (sheetMap.approvalStartRow > 0 && oldTotalRow > 0 && oldTotalRow < sheetMap.approvalStartRow)
        ? {
            startRow: sheetMap.approvalStartRow,
            rowData: (() => {
              const result: CapturedStyle[] = []
              for (let r = sheetMap.approvalStartRow; r <= ws.rowCount; r++) {
                result.push(captureRowStyle(ws.getRow(r)))
              }
              return result
            })(),
          }
        : null

    if (oldTotalRow >= referenceRowNum) {
      const removeCount = oldTotalRow - referenceRowNum + 1
      ws.spliceRows(referenceRowNum, removeCount)
    }

    const insertPos = referenceRowNum

    let no = 1
    for (const row of dataRows) {
      const excelRow = ws.getRow(insertPos + (no - 1))
      const values = buildRowValues(row, no)
      applyCapturedStyle(excelRow, capturedEmployeeStyle)
      values.forEach((v, i) => { excelRow.getCell(i + 1).value = v })
      excelRow.commit()

      manifest.push({
        payrollRowId: row.id || '',
        employeeId: row.employeeId || '',
        employeeCode: row.employeeCode || '',
        employeeName: row.employeeName || '',
        payrollGroup: row.payrollGroup as string || '',
        sheetName: name,
        worksheetRowNumber: insertPos + (no - 1),
      })
      no++
    }

    const dataStartActual = insertPos
    const dataEndActual = insertPos + dataRows.length - 1
    const totalRowNum = dataEndActual + 1

    const totalRow = ws.getRow(totalRowNum)
    applyCapturedStyle(totalRow, capturedEmployeeStyle)
    totalRow.getCell(2).value = `Total (${dataRows.length} employees)`
    totalRow.getCell(2).font = { bold: true }

    const totalCols = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
    for (const col of totalCols) {
      const cell = totalRow.getCell(col)
      if (dataRows.length > 0) {
        cell.value = { formula: `SUM(${colToLetter(col)}${dataStartActual}:${colToLetter(col)}${dataEndActual})` }
      } else {
        cell.value = 0
      }
      cell.numFmt = '#,##0.00'
      cell.font = { bold: true }
    }

    if (approvalSection) {
      const afterTotal = totalRowNum + 1
      for (let i = 0; i < approvalSection.rowData.length; i++) {
        const targetRow = ws.getRow(afterTotal + i)
        applyCapturedStyle(targetRow, approvalSection.rowData[i])
        targetRow.commit()
      }
    }

    for (const rangeStr of mergedCellRanges) {
      try {
        ws.mergeCells(rangeStr)
      } catch {
        // ignore invalid merge ranges
      }
    }

    const titleRow = ws.getRow(1)
    const titleCell = titleRow.getCell(1)
    if (titleCell.value) {
      titleCell.value = `Payroll for ${periodLabel} - ${name}`
    }
  }

  buildSupportingSheets(templateWb, rows, periodLabel)

  await templateWb.xlsx.writeFile(filePath)

  const fileBuffer = await fs.readFile(filePath)
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')

  const totalGross = rows.reduce((s, r) => s.plus(Number(r.grossSalary || 0)), new Decimal(0))
  const totalDeductions = rows.reduce((s, r) => s.plus(Number(r.totalDeduction || 0)), new Decimal(0))
  const totalNet = rows.reduce((s, r) => s.plus(Number(r.netSalary || 0)), new Decimal(0))

  return {
    fileName: path.basename(filePath),
    rowCount: rows.length,
    totalGross: totalGross.toNumber(),
    totalDeductions: totalDeductions.toNumber(),
    totalNet: totalNet.toNumber(),
    checksum,
    templateVersion: TEMPLATE_VERSION,
    sheetCount: WORKSHEET_NAMES.length,
    sheetNames: [...WORKSHEET_NAMES],
    manifest,
  }
}