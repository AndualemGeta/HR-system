import ExcelJS from 'exceljs'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { computePayroll } from './calculation'
import {
  WORKSHEET_NAMES,
  COLUMN_HEADERS_A_S,
  TEMPLATE_PATH,
  TEMPLATE_VERSION,
} from './template-map'
import type { MvpPayrollRow } from '@prisma/client'

function findDataStartRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= (ws.rowCount || 20); r++) {
    const cellVal = ws.getRow(r).getCell(1).value
    if (!cellVal || String(cellVal).trim() === '') continue
    const cellText = String(cellVal).trim().toLowerCase()
    if (cellText === 'no.' || cellText === 'no') return r + 1
  }
  return 3
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
}

export async function generateExcel(opts: GenerateExcelOptions): Promise<GenerateExcelResult> {
  const { rows, periodLabel, filePath } = opts

  async function buildWorkbook(): Promise<ExcelJS.Workbook> {
    try {
      const templateWb = await new ExcelJS.Workbook().xlsx.readFile(TEMPLATE_PATH)
      const sheetGroups: Record<string, typeof rows> = {}
      for (const row of rows) {
        const pg = row.payrollGroup as string | null
        const sheetName = pg && WORKSHEET_NAMES.includes(pg as typeof WORKSHEET_NAMES[number])
          ? (pg as string)
          : 'Unassigned'
        if (!sheetGroups[sheetName]) sheetGroups[sheetName] = []
        sheetGroups[sheetName].push(row)
      }

      for (const ws of templateWb.worksheets) {
        const name = ws.name
        if (WORKSHEET_NAMES.includes(name as typeof WORKSHEET_NAMES[number])) {
          const dataRows = sheetGroups[name] || []
          writePayrollDataIntoSheet(ws, dataRows, periodLabel)
        }
      }

      return templateWb
    } catch {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Leapfrog HR MVP'
      wb.created = new Date()

      const sheetGroups: Record<string, typeof rows> = {}
      for (const row of rows) {
        const pg = row.payrollGroup as string | null
        const sheetName = pg && WORKSHEET_NAMES.includes(pg as typeof WORKSHEET_NAMES[number])
          ? (pg as string)
          : 'Unassigned'
        if (!sheetGroups[sheetName]) sheetGroups[sheetName] = []
        sheetGroups[sheetName].push(row)
      }

      for (const sheetName of WORKSHEET_NAMES) {
        const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })
        writePayrollSheet(ws, sheetGroups[sheetName] || [], `${periodLabel} — ${sheetName}`)
      }

      if (sheetGroups['Unassigned'] && sheetGroups['Unassigned'].length > 0) {
        const ws = wb.addWorksheet('Unassigned', { views: [{ showGridLines: false }] })
        writePayrollSheet(ws, sheetGroups['Unassigned'], `${periodLabel} — Unassigned`)
      }

      const totalGross = rows.reduce((s, r) => s + Number(r.grossSalary || 0), 0)
      const totalDeductions = rows.reduce((s, r) => s + Number(r.totalDeduction || 0), 0)
      const totalNet = rows.reduce((s, r) => s + Number(r.netSalary || 0), 0)

      const perfWs = wb.addWorksheet('Performance Summary', { views: [{ showGridLines: false }] })
      perfWs.mergeCells('A1:D1')
      perfWs.getCell('A1').value = 'Performance Summary'
      perfWs.getCell('A1').font = { bold: true, size: 12 }
      perfWs.addRow(['Metric', 'Value', 'Period', periodLabel])
      perfWs.addRow(['Total Employees', rows.length])
      perfWs.addRow(['Gross Salary Total', totalGross])
      perfWs.addRow(['Total Deductions', totalDeductions])
      perfWs.addRow(['Net Pay Total', totalNet])
      perfWs.getColumn(1).width = 25
      perfWs.getColumn(2).width = 20

      const otWs = wb.addWorksheet('Overtime', { views: [{ showGridLines: false }] })
      otWs.mergeCells('A1:D1')
      otWs.getCell('A1').value = 'Overtime Summary'
      otWs.getCell('A1').font = { bold: true, size: 12 }
      otWs.addRow(['Employee Code', 'Employee Name', 'Overtime Amount', 'Period'])
      for (const row of rows) {
        const ot = Number(row.overtime || 0)
        if (ot > 0) {
          otWs.addRow([row.employeeCode || '', row.employeeName || '', ot, periodLabel])
        }
      }

      return wb
    }
  }

  const wb = await buildWorkbook()
  await wb.xlsx.writeFile(filePath)

  const fileBuffer = await fs.readFile(filePath)
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')

  const totalGross = rows.reduce((s, r) => s + Number(r.grossSalary || 0), 0)
  const totalDeductions = rows.reduce((s, r) => s + Number(r.totalDeduction || 0), 0)
  const totalNet = rows.reduce((s, r) => s + Number(r.netSalary || 0), 0)

  const fileName = path.basename(filePath)

  return {
    fileName,
    rowCount: rows.length,
    totalGross,
    totalDeductions,
    totalNet,
    checksum,
    templateVersion: TEMPLATE_VERSION,
    sheetCount: WORKSHEET_NAMES.length,
    sheetNames: [...WORKSHEET_NAMES],
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

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, size: 10 }
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } }
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
}

function writePayrollSheet(ws: ExcelJS.Worksheet, rows: Partial<MvpPayrollRow>[], sheetLabel: string) {
  ws.mergeCells('A1:S1')
  const title = ws.getCell('A1')
  title.value = sheetLabel
  title.font = { bold: true, size: 14 }
  title.alignment = { horizontal: 'center', vertical: 'middle' }

  const headerRow = ws.addRow([...COLUMN_HEADERS_A_S])
  styleHeaderRow(headerRow)

  let no = 1
  for (const row of rows) {
    ws.addRow(buildRowValues(row, no++))
  }

  const dataStart = 3
  const dataEnd = ws.rowCount
  const totalRow = ws.addRow([])
  const totalLabel = totalRow.getCell(2)
  totalLabel.value = `Total (${rows.length} employees)`
  totalLabel.font = { bold: true }

  const totalCols = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
  for (const col of totalCols) {
    const cell = totalRow.getCell(col)
    cell.value = { formula: `SUM(${colToLetter(col)}${dataStart}:${colToLetter(col)}${dataEnd})` }
    cell.numFmt = '#,##0.00'
    cell.font = { bold: true }
  }

  const colWidths = [5, 22, 18, 18, 10, 12, 12, 12, 10, 12, 12, 12, 10, 10, 12, 12, 12, 12, 8]
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
}

function writePayrollDataIntoSheet(ws: ExcelJS.Worksheet, rows: Partial<MvpPayrollRow>[], _periodLabel: string) {
  const startRow = findDataStartRow(ws)
  let no = 1
  for (const row of rows) {
    const excelRow = ws.getRow(startRow + (no - 1))
    const values = buildRowValues(row, no)
    values.forEach((v, i) => { excelRow.getCell(i + 1).value = v })
    excelRow.commit()
    no++
  }

  const dataStart = startRow
  const dataEnd = startRow + rows.length - 1
  const totalRowNum = dataEnd + 1
  const totalRow = ws.getRow(totalRowNum)
  const totalLabel = totalRow.getCell(2)
  totalLabel.value = `Total (${rows.length} employees)`
  totalLabel.font = { bold: true }

  const totalCols = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
  for (const col of totalCols) {
    const cell = totalRow.getCell(col)
    cell.value = { formula: `SUM(${colToLetter(col)}${dataStart}:${colToLetter(col)}${dataEnd})` }
    cell.numFmt = '#,##0.00'
    cell.font = { bold: true }
  }
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
      basicSalary: basic,
      workingDays,
      commission,
      overtime,
      incentive: kpi,
      allowance,
      otherDeduction: shortageLoan,
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
    no,
    row.employeeName || '',
    row.role || '',
    row.shop || row.location || row.department || '',
    workingDays,
    basic,
    monthlySalary,
    commission + overtime,
    kpi,
    grossSalary,
    taxableIncome,
    incomeTax,
    employeePension,
    employerPension,
    shortageLoan,
    totalDeduction,
    allowance,
    netSalary,
    '',
  ]
}
