import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { notFound, success, badRequest, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import ExcelJS from 'exceljs'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const EXPORT_DIR = path.join(process.cwd(), 'uploads', 'payroll-exports')

// Data columns (A=1, B=2, ... R=18, S=19)
const COL_HEADERS = [
  'No.', 'Name of Employees', 'Position', 'Shop Name / Work Place',
  'Working days', 'Basic Salary', 'Monthly Salary', 'Commiss. / OT',
  'KPI', 'Gross Salary', 'Taxable Income', 'Income Tax',
  'Pension 7%', 'Pension 11%', 'Shortage / Loan', 'Total Deduction',
  'Transport & Other Allowance', 'Net Pay', 'Sign',
]

// Payroll sheet names from the company workbook
const PAYROLL_SHEETS = [
  'HO,A.A SHOP', 'DSA', 'EBU Department', 'Aleletu', 'Chacha',
  'Legetafo', 'Hmariam', 'Sirti', 'Mendida', 'Sendafa', 'Sheno',
]

function sheetKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Map employee location to sheet name
function sheetForEmployee(location: string | null, department: string | null, role: string | null): string {
  const loc = (location || department || '').toLowerCase()

  // Direct location/shop name matches
  for (const sheet of PAYROLL_SHEETS) {
    const sk = sheetKey(sheet)
    if (sk.includes(sheetKey(loc)) || sheetKey(loc).includes(sk)) {
      return sheet
    }
  }

  // Role-based mapping
  const roleLower = (role || '').toLowerCase()
  if (roleLower.includes('dsa')) return 'DSA'
  if (roleLower.includes('ebu') || roleLower.includes('ftth')) return 'EBU Department'

  // Department-based fallback
  const dept = (department || '').toLowerCase()
  if (dept.includes('ho') || dept.includes('head') || dept.includes('a.a') || dept.includes('head office')) return 'HO,A.A SHOP'

  return 'HO,A.A SHOP' // default
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

async function writePayrollSheet(ws: ExcelJS.Worksheet, rows: Array<Record<string, unknown>>, periodName: string) {
  // Title row
  ws.mergeCells('A1:S1')
  const title = ws.getCell('A1')
  title.value = `Salary For The Month Of ${periodName}`
  title.font = { bold: true, size: 14 }
  title.alignment = { horizontal: 'center', vertical: 'middle' }

  // Column headers (row 3)
  const headerRow = ws.addRow(COL_HEADERS)
  styleHeaderRow(headerRow)

  // Data rows
  let no = 1
  for (const row of rows) {
    const basic = Number(row.basicSalary || 0)
    const workingDays = Number(row.workingDays || 30)
    const monthlySalary = Number(row.monthlySalary || 0) || Math.round((basic / 30) * workingDays * 100) / 100
    const commission = Number(row.commission || 0)
    const overtime = Number(row.overtime || 0)
    const commissionOt = commission + overtime
    const kpi = Number(row.incentive || 0)
    const grossSalary = Number(row.grossSalary || 0) || Math.round((monthlySalary + commissionOt + kpi) * 100) / 100
    const taxableIncome = Number(row.taxableIncome || 0) || grossSalary
    const incomeTax = Number(row.incomeTax || 0)
    const employeePension = Number(row.employeePension || 0)
    const employerPension = Number(row.employerPension || 0)
    const shortageLoan = Number(row.otherDeduction || 0)
    const totalDeduction = Number(row.totalDeduction || 0) || Math.round((incomeTax + employeePension + shortageLoan) * 100) / 100
    const transportAllowance = Number(row.allowance || 0)
    const netSalary = Number(row.netSalary || 0) || Math.round((grossSalary - totalDeduction + transportAllowance) * 100) / 100

    ws.addRow([
      no++, row.employeeName || '', row.role || '', row.location || row.department || '',
      workingDays, basic, monthlySalary, commissionOt,
      kpi, grossSalary, taxableIncome, incomeTax,
      employeePension, employerPension, shortageLoan, totalDeduction,
      transportAllowance, netSalary, row.notes || '',
    ])
  }

  // Totals row
  const dataStart = 4
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

  // Column widths
  const colWidths = [5, 22, 18, 18, 10, 12, 12, 12, 10, 12, 12, 12, 10, 10, 12, 12, 12, 12, 8]
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // Print setup
  ws.pageSetup.orientation = 'landscape'
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPeriod.close'))) return forbidden()

    const period = await prisma.mvpPayrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY' && period.status !== 'LOCKED') return badRequest('Period must be READY or LOCKED')

    const rows = await prisma.mvpPayrollRow.findMany({
      where: { payrollPeriodId: id },
      orderBy: [{ location: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
    })
    if (rows.length === 0) return badRequest('No rows to export')

    // Group rows by sheet
    const sheetGroups: Record<string, typeof rows> = {}
    for (const row of rows) {
      const sheet = sheetForEmployee(row.location, row.department, row.role)
      if (!sheetGroups[sheet]) sheetGroups[sheet] = []
      sheetGroups[sheet].push(row)
    }

    // Generate workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Leapfrog HR MVP'
    wb.created = new Date()

    const periodLabel = `${period.periodName} (${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]})`

    // Create payroll sheets in the defined order
    const createdSheets = new Set<string>()
    for (const sheetName of PAYROLL_SHEETS) {
      const sheetRows = sheetGroups[sheetName] || []
      createdSheets.add(sheetName)
      const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })
      await writePayrollSheet(ws, sheetRows.map(r => r as unknown as Record<string, unknown>), periodLabel)
    }

    // Add unassigned rows to a catch-all sheet (shouldn't happen with proper mapping)
    const assigned = new Set<string>()
    for (const s of PAYROLL_SHEETS) {
      for (const r of (sheetGroups[s] || [])) assigned.add(r.id)
    }
    const unassigned = rows.filter(r => !assigned.has(r.id))
    if (unassigned.length > 0) {
      const ws = wb.addWorksheet('Other', { views: [{ showGridLines: false }] })
      await writePayrollSheet(ws, unassigned.map(r => r as unknown as Record<string, unknown>), periodLabel)
    }

    // Performance Summary sheet
    const perfWs = wb.addWorksheet('Performance Summary', { views: [{ showGridLines: false }] })
    perfWs.mergeCells('A1:D1')
    perfWs.getCell('A1').value = 'Performance Summary'
    perfWs.getCell('A1').font = { bold: true, size: 12 }
    perfWs.addRow(['Metric', 'Value', 'Period', periodLabel])

    // Overtime sheet
    const otWs = wb.addWorksheet('Overtime', { views: [{ showGridLines: false }] })
    otWs.mergeCells('A1:D1')
    otWs.getCell('A1').value = 'Overtime Summary'
    otWs.getCell('A1').font = { bold: true, size: 12 }
    otWs.addRow(['Employee', 'Overtime Amount', 'Period', periodLabel])

    // Ensure export directory exists
    await fs.mkdir(EXPORT_DIR, { recursive: true })

    const fileName = `payroll_${period.periodName}_${Date.now()}.xlsx`
    const filePath = path.join(EXPORT_DIR, fileName)
    await wb.xlsx.writeFile(filePath)

    // Read file for checksum
    const fileBuffer = await fs.readFile(filePath)
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    const totals = {
      totalGross: rows.reduce((s, r) => s + Number(r.grossSalary || 0), 0),
      totalDeductions: rows.reduce((s, r) => s + Number(r.totalDeduction || 0), 0),
      totalNet: rows.reduce((s, r) => s + Number(r.netSalary || 0), 0),
    }

    const exportRecord = await prisma.mvpPayrollExport.create({
      data: {
        payrollPeriodId: id,
        fileName,
        format: 'XLSX',
        rowCount: rows.length,
        totalGross: totals.totalGross,
        totalDeductions: totals.totalDeductions,
        totalNet: totals.totalNet,
        checksum,
        templateVersion: 'MVP-1.0',
        generatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId, action: 'EXPORT_CREATE', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { fileName, rowCount: rows.length, sheets: PAYROLL_SHEETS.length },
    })

    return success({ export: exportRecord, downloadUrl: `/api/payroll/${id}/download-excel?file=${fileName}` })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
