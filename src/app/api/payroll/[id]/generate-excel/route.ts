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
      orderBy: [{ department: 'asc' }, { employeeName: 'asc' }],
    })
    if (rows.length === 0) return badRequest('No rows to export')

    // Generate workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Leapfrog HR MVP'
    wb.created = new Date()

    const ws = wb.addWorksheet('Payroll')

    // Title row
    ws.mergeCells('A1:R1')
    const titleCell = ws.getCell('A1')
    titleCell.value = `Payroll - ${period.periodName}`
    titleCell.font = { bold: true, size: 14 }
    titleCell.alignment = { horizontal: 'center' }

    // Column headers
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Role', 'Location',
      'Basic Salary', 'Allowance', 'Overtime', 'Incentive', 'Commission',
      'Gross Salary', 'Employee Pension', 'Income Tax', 'Other Deduction',
      'Total Deduction', 'Net Salary', 'Payment Method', 'Bank Name',
      'Bank Account', 'M-PESA', 'Notes',
    ]

    const headerRow = ws.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
    })

    // Data rows
    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    for (const row of rows) {
      const gross = Number(row.grossSalary || 0)
      const deductions = Number(row.totalDeduction || 0)
      const net = Number(row.netSalary || 0)
      totalGross += gross
      totalDeductions += deductions
      totalNet += net

      ws.addRow([
        row.employeeCode, row.employeeName, row.department || '', row.role || '', row.location || '',
        row.basicSalary || 0, row.allowance || 0, row.overtime || 0, row.incentive || 0, row.commission || 0,
        gross, row.employeePension || 0, row.incomeTax || 0, row.otherDeduction || 0,
        deductions, net, row.paymentMethod || '', row.bankName || '',
        row.bankAccountNumber || '', row.mpesaAccount || '', row.notes || '',
      ])
    }

    // Totals row
    const totalsRow = ws.addRow([
      '', 'TOTALS', '', '', '',
      rows.reduce((s, r) => s + Number(r.basicSalary || 0), 0),
      rows.reduce((s, r) => s + Number(r.allowance || 0), 0),
      rows.reduce((s, r) => s + Number(r.overtime || 0), 0),
      rows.reduce((s, r) => s + Number(r.incentive || 0), 0),
      rows.reduce((s, r) => s + Number(r.commission || 0), 0),
      totalGross,
      rows.reduce((s, r) => s + Number(r.employeePension || 0), 0),
      rows.reduce((s, r) => s + Number(r.incomeTax || 0), 0),
      rows.reduce((s, r) => s + Number(r.otherDeduction || 0), 0),
      totalDeductions, totalNet,
    ])
    totalsRow.font = { bold: true }
    totalsRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
    })

    // Number format for money columns
    for (let r = 3; r <= ws.rowCount; r++) {
      for (let c = 6; c <= 16; c++) {
        const cell = ws.getCell(r, c)
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00'
        }
      }
    }

    // Auto-width
    ws.columns.forEach((col, i) => {
      if (col) {
        let maxLen = headers[i].length + 2
        ws.getColumn(i + 1).eachCell(cell => {
          const val = String(cell.value || '')
          maxLen = Math.max(maxLen, val.length + 2)
        })
        ws.getColumn(i + 1).width = Math.min(maxLen, 30)
      }
    })

    // Ensure export directory exists
    await fs.mkdir(EXPORT_DIR, { recursive: true })

    const fileName = `payroll_${period.periodName}_${Date.now()}.xlsx`
    const filePath = path.join(EXPORT_DIR, fileName)
    await wb.xlsx.writeFile(filePath)

    // Read file for checksum
    const fileBuffer = await fs.readFile(filePath)
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    const exportRecord = await prisma.mvpPayrollExport.create({
      data: {
        payrollPeriodId: id,
        fileName,
        format: 'XLSX',
        rowCount: rows.length,
        totalGross,
        totalDeductions: totalDeductions,
        totalNet,
        checksum,
        templateVersion: 'MVP-1.0',
        generatedById: session.userId,
      },
    })

    await createAuditLog({
      userId: session.userId, action: 'EXPORT_CREATE', entityType: 'MvpPayrollPeriod',
      entityId: id, newValue: { fileName, rowCount: rows.length },
    })

    return success({ export: exportRecord, downloadUrl: `/api/payroll/${id}/download-excel?file=${fileName}` })
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
