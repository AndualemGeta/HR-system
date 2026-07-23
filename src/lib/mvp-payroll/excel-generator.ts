import ExcelJS from 'exceljs'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import Decimal from 'decimal.js'
import { computePayroll } from './calculation'
import {
  WORKSHEET_NAMES,
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
}

function analyzeWorksheet(ws: ExcelJS.Worksheet): SheetMapEntry {
  let headerRow = 0
  let dataStartRow = 0
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
      break
    }
  }

  if (!headerRow) headerRow = 3
  if (!dataStartRow) dataStartRow = headerRow + 1
  return { sheetName: ws.name, headerRow, dataStartRow, totalRow }
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

function verifyTemplate(wb: ExcelJS.Workbook): void {
  const wsNames = wb.worksheets.map(ws => ws.name)
  for (const name of WORKSHEET_NAMES) {
    if (!wsNames.includes(name)) {
      throw new Error(`Template missing required worksheet: "${name}"`)
    }
  }
  for (const ws of wb.worksheets) {
    if (WORKSHEET_NAMES.includes(ws.name as typeof WORKSHEET_NAMES[number])) {
      const map = analyzeWorksheet(ws)
      if (!map.headerRow) {
        throw new Error(`Template sheet "${ws.name}" is missing a header row`)
      }
    }
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

    const rowCountBeforeData = sheetMap.dataStartRow - 1
    const existingTotalRow = sheetMap.totalRow
    const existingDataEnd = existingTotalRow > 0 ? existingTotalRow - 1 : sheetMap.dataStartRow

    if (existingDataEnd >= sheetMap.dataStartRow) {
      ws.spliceRows(sheetMap.dataStartRow, existingDataEnd - sheetMap.dataStartRow + 1)
    }

    let no = 1
    for (const row of dataRows) {
      const excelRow = ws.getRow(sheetMap.dataStartRow + (no - 1))
      const values = buildRowValues(row, no)
      values.forEach((v, i) => { excelRow.getCell(i + 1).value = v })
      excelRow.commit()

      manifest.push({
        payrollRowId: row.id || '',
        employeeId: row.employeeId || '',
        employeeCode: row.employeeCode || '',
        employeeName: row.employeeName || '',
        payrollGroup: row.payrollGroup as string || '',
        sheetName: name,
        worksheetRowNumber: sheetMap.dataStartRow + (no - 1),
      })
      no++
    }

    const dataStartActual = sheetMap.dataStartRow
    const dataEndActual = dataStartActual + dataRows.length - 1
    const totalRowNum = dataEndActual + 1

    const totalRow = ws.getRow(totalRowNum)
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
  }

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
