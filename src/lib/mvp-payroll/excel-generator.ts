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
  let titleRow = 1
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
    if (totalRow > 0 && cell2.startsWith('prepared') || cell2.startsWith('approved') || cell2.startsWith('authorized') || cell2.startsWith('signature') || cell2.startsWith('hr') || cell2.startsWith('finance') || cell2.startsWith('general manager') || cell2.startsWith('gm')) {
      if (!approvalStartRow) approvalStartRow = r
    }
  }

  if (!headerRow) headerRow = 3
  if (!totalRow) totalRow = 0

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

function copyRowStyle(source: ExcelJS.Row, target: ExcelJS.Row): void {
  if (source.height) target.height = source.height
  for (let c = 1; c <= 19; c++) {
    const srcCell = source.getCell(c)
    const tgtCell = target.getCell(c)
    if (srcCell.style) {
      tgtCell.style = { ...srcCell.style }
    }
    if (srcCell.numFmt) tgtCell.numFmt = srcCell.numFmt
    if (srcCell.font) tgtCell.font = { ...srcCell.font }
    if (srcCell.fill) tgtCell.fill = { ...srcCell.fill }
    if (srcCell.border) tgtCell.border = { ...srcCell.border }
    if (srcCell.alignment) tgtCell.alignment = { ...srcCell.alignment }
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
  const overtime = wb.getWorksheet(OVERTIME_SHEET)

  if (summary) {
    summary.spliceRows(1, summary.rowCount)

    summary.getRow(1).getCell(1).value = `Performance Summary - ${periodLabel}`
    summary.getRow(1).getCell(1).font = { bold: true, size: 14 }

    summary.getRow(3).getCell(1).value = 'Employee Name'
    summary.getRow(3).getCell(2).value = 'Payroll Group'
    summary.getRow(3).getCell(3).value = 'Gross Salary'
    summary.getRow(3).getCell(4).value = 'Total Deduction'
    summary.getRow(3).getCell(5).value = 'Net Pay'
    summary.getRow(3).font = { bold: true }

    let r = 4
    for (const row of rows) {
      summary.getRow(r).getCell(1).value = row.employeeName || ''
      summary.getRow(r).getCell(2).value = row.payrollGroup || ''
      summary.getRow(r).getCell(3).value = Number(row.grossSalary || 0)
      summary.getRow(r).getCell(4).value = Number(row.totalDeduction || 0)
      summary.getRow(r).getCell(5).value = Number(row.netSalary || 0)
      for (let c = 3; c <= 5; c++) {
        summary.getRow(r).getCell(c).numFmt = '#,##0.00'
      }
      r++
    }

    const totalRow = summary.getRow(r)
    totalRow.getCell(1).value = 'TOTAL'
    totalRow.getCell(1).font = { bold: true }
    totalRow.getCell(3).value = { formula: `SUM(C4:C${r - 1})` }
    totalRow.getCell(4).value = { formula: `SUM(D4:D${r - 1})` }
    totalRow.getCell(5).value = { formula: `SUM(E4:E${r - 1})` }
    for (let c = 3; c <= 5; c++) {
      totalRow.getCell(c).numFmt = '#,##0.00'
      totalRow.getCell(c).font = { bold: true }
    }
  }

  if (overtime) {
    overtime.spliceRows(1, overtime.rowCount)

    overtime.getRow(1).getCell(1).value = `Overtime Report - ${periodLabel}`
    overtime.getRow(1).getCell(1).font = { bold: true, size: 14 }

    overtime.getRow(3).getCell(1).value = 'Employee Name'
    overtime.getRow(3).getCell(2).value = 'Payroll Group'
    overtime.getRow(3).getCell(3).value = 'Overtime Hours'
    overtime.getRow(3).getCell(4).value = 'Overtime Amount'
    overtime.getRow(3).font = { bold: true }

    let r = 4
    for (const row of rows) {
      const otValue = Number(row.overtime || 0)
      overtime.getRow(r).getCell(1).value = row.employeeName || ''
      overtime.getRow(r).getCell(2).value = row.payrollGroup || ''
      overtime.getRow(r).getCell(3).value = otValue > 0 ? otValue / (Number(row.basicSalary || 1) / 30 / 8) : 0
      overtime.getRow(r).getCell(4).value = otValue
      overtime.getRow(r).getCell(4).numFmt = '#,##0.00'
      r++
    }

    const totalRow = overtime.getRow(r)
    totalRow.getCell(1).value = 'TOTAL'
    totalRow.getCell(1).font = { bold: true }
    totalRow.getCell(4).value = { formula: `SUM(D4:D${r - 1})` }
    totalRow.getCell(4).numFmt = '#,##0.00'
    totalRow.getCell(4).font = { bold: true }
  }
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

    let approvalSection: { startRow: number; endRow: number; rowData: { height?: number; cells: { value: ExcelJS.CellValue; style: Record<string, unknown> }[] }[] } | null = null

    if (sheetMap.approvalStartRow > 0 && oldTotalRow > 0 && oldTotalRow < sheetMap.approvalStartRow) {
      approvalSection = {
        startRow: sheetMap.approvalStartRow,
        endRow: ws.rowCount,
        rowData: [],
      }
      for (let r = sheetMap.approvalStartRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const cells: { value: ExcelJS.CellValue; style: Record<string, unknown> }[] = []
        for (let c = 1; c <= 19; c++) {
          const cell = row.getCell(c)
          cells.push({ value: cell.value as ExcelJS.CellValue, style: cell.style as unknown as Record<string, unknown> })
        }
        approvalSection.rowData.push({
          height: row.height,
          cells,
        })
      }
      approvalSection.endRow = approvalSection.startRow + approvalSection.rowData.length - 1
    }

    const mergedCellsToPreserve: { tl: string; br: string }[] = []

    if (oldTotalRow >= sheetMap.dataStartRow) {
      const removeCount = oldTotalRow - sheetMap.dataStartRow + 1
      ws.spliceRows(sheetMap.dataStartRow, removeCount)
    }

    const insertPos = sheetMap.dataStartRow
    const referenceRow = ws.getRow(referenceRowNum >= insertPos ? referenceRowNum : insertPos)

    let no = 1
    for (const row of dataRows) {
      const excelRow = ws.getRow(insertPos + (no - 1))
      const values = buildRowValues(row, no)
      values.forEach((v, i) => { excelRow.getCell(i + 1).value = v })
      copyRowStyle(referenceRow, excelRow)
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
    copyRowStyle(referenceRow, totalRow)
    const totalLabel = totalRow.getCell(2)
    totalLabel.value = `Total (${dataRows.length} employees)`
    totalLabel.font = { bold: true }

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
      const neededRows = approvalSection.rowData.length
      for (let i = 0; i < neededRows; i++) {
        const targetRow = ws.getRow(afterTotal + i)
        const src = approvalSection.rowData[i]
        if (src.height) targetRow.height = src.height
        for (let c = 0; c < src.cells.length; c++) {
          const cell = targetRow.getCell(c + 1)
          cell.value = src.cells[c].value as ExcelJS.CellValue
          if (src.cells[c].style) {
            try { cell.style = src.cells[c].style as unknown as ExcelJS.Style } catch { /* ignore style errors */ }
          }
        }
        targetRow.commit()
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